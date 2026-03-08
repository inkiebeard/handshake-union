-- ============================================
-- Add link_url column to messages
-- ============================================
-- Optional link attachment: one URL per message, https only, max 2048 chars.
-- Links are open-domain (any https URL) — unlike image_url which is CDN-restricted.

-- 1. Add the column
ALTER TABLE public.messages
  ADD COLUMN link_url TEXT CHECK (
    link_url IS NULL OR (
      char_length(link_url) <= 2048
      AND link_url ~ '^https://'
    )
  );

-- 2. Extend the has-body constraint to include link_url as a valid body
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_has_body;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_has_body CHECK (
    (content IS NOT NULL AND char_length(trim(content)) > 0)
    OR
    (image_url IS NOT NULL AND char_length(trim(image_url)) > 0)
    OR
    (link_url IS NOT NULL AND char_length(trim(link_url)) > 0)
  );

-- 3. Update receipt hash to include link_url.
-- Messages expire in 72 h; all pre-migration receipts will naturally expire before
-- they could be reported under the new hash formula, so there is no backward-compat
-- window to handle.
CREATE OR REPLACE FUNCTION create_message_receipt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.message_receipts (content_hash, room, created_at)
  VALUES (
    digest(
      COALESCE(NEW.content, '') || chr(0) || COALESCE(NEW.image_url, '') || chr(0) || COALESCE(NEW.link_url, ''),
      'sha256'
    ),
    NEW.room,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. Add message_link_url snapshot column to moderation_reports
ALTER TABLE public.moderation_reports
  ADD COLUMN message_link_url TEXT;

-- 5. Update report_message() to include link_url in receipt hash and report snapshot
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

  SELECT id, room, profile_id, content, image_url, link_url, created_at
  INTO msg
  FROM public.messages
  WHERE id = target_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found — it may have expired.';
  END IF;

  IF msg.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot report your own message';
  END IF;

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

  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash = digest(
      COALESCE(msg.content, '') || chr(0) || COALESCE(msg.image_url, '') || chr(0) || COALESCE(msg.link_url, ''),
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
    message_link_url,
    message_author_id,
    message_room,
    message_created_at
  ) VALUES (
    receipt.id,
    auth.uid(),
    report_reason,
    msg.content,
    msg.image_url,
    msg.link_url,
    msg.profile_id,
    msg.room,
    msg.created_at
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
