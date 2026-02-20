-- Fix create_message_receipt and report_message to use extensions.digest()
-- (mirrors the pattern from 010_fix_digest_extensions_schema.sql)

CREATE OR REPLACE FUNCTION create_message_receipt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.message_receipts (content_hash, room, created_at)
  VALUES (
    extensions.digest(
      COALESCE(NEW.content, '') || chr(0) || COALESCE(NEW.image_url, ''),
      'sha256'
    ),
    NEW.room,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions';

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
  WHERE r.content_hash = extensions.digest(
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions';
