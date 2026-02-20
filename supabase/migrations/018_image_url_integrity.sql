-- ============================================
-- Image URL Integrity + Content Optionality
-- ============================================
-- 1. Allow image-only messages (content becomes nullable)
-- 2. Include image_url in receipt hash so attachments are covered
-- 3. Capture image_url in moderation reports

-- ============================================
-- 1. MESSAGES: make content nullable, enforce at least one of content/image_url
-- ============================================

ALTER TABLE public.messages
  ALTER COLUMN content DROP NOT NULL;

-- At least one of content or image_url must be present and non-empty
ALTER TABLE public.messages
  ADD CONSTRAINT messages_has_body CHECK (
    (content IS NOT NULL AND char_length(trim(content)) > 0)
    OR
    (image_url IS NOT NULL AND char_length(trim(image_url)) > 0)
  );

-- ============================================
-- 2. UPDATE RECEIPT TRIGGER: hash content + image_url together
-- ============================================
-- Uses chr(0) as a separator — can't appear in text content or URLs,
-- so it prevents hash collisions between (content="ab", url="c") and
-- (content="a", url="bc") etc.

CREATE OR REPLACE FUNCTION create_message_receipt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.message_receipts (content_hash, room, created_at)
  VALUES (
    digest(
      COALESCE(NEW.content, '') || chr(0) || COALESCE(NEW.image_url, ''),
      'sha256'
    ),
    NEW.room,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 3. MODERATION REPORTS: capture image_url in report snapshot
-- ============================================

ALTER TABLE public.moderation_reports
  ADD COLUMN message_image_url TEXT;

-- ============================================
-- 4. UPDATE report_message(): snapshot image_url, use new hash
-- ============================================

CREATE OR REPLACE FUNCTION report_message(
  target_message_id UUID,
  report_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  msg RECORD;
  receipt RECORD;
  report_count INT;
  existing_report UUID;
  new_report_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT count(*) INTO report_count
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND reported_at > now() - interval '1 hour';

  IF report_count >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded: maximum 10 reports per hour';
  END IF;

  -- Capture image_url alongside content
  SELECT id, room, profile_id, content, image_url, created_at
  INTO msg
  FROM public.messages
  WHERE id = target_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found — it may have expired.';
  END IF;

  IF msg.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot report your own message';
  END IF;

  -- Duplicate check covers both content and image_url
  SELECT id INTO existing_report
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND message_content IS NOT DISTINCT FROM msg.content
    AND message_image_url IS NOT DISTINCT FROM msg.image_url
    AND message_room = msg.room
    AND message_created_at = msg.created_at;

  IF FOUND THEN
    RAISE EXCEPTION 'you have already reported this message';
  END IF;

  -- Receipt lookup uses the updated hash (content + chr(0) + image_url)
  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash = digest(
      COALESCE(msg.content, '') || chr(0) || COALESCE(msg.image_url, ''),
      'sha256'
    )
    AND r.room = msg.room
    AND r.created_at = msg.created_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'integrity error: no receipt found for this message';
  END IF;

  INSERT INTO public.moderation_reports (
    receipt_id,
    reporter_id,
    reason,
    message_content,
    message_image_url,
    message_author_id,
    message_room,
    message_created_at
  ) VALUES (
    receipt.id,
    auth.uid(),
    report_reason,
    msg.content,
    msg.image_url,
    msg.profile_id,
    msg.room,
    msg.created_at
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
