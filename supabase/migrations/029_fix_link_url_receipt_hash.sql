-- ============================================
-- Fix create_message_receipt and report_message
-- to include link_url using the correct hash scheme
-- ============================================
-- Migration 028 had two bugs:
--   1. SET search_path = '' hides extensions.digest() → "function does not exist"
--   2. Used the old chr(0) separator instead of the per-field double-SHA256
--      scheme introduced in migration 020.
--
-- Correct hash scheme (matches 020/021):
--   SHA256(
--     hex(SHA256(content))   ||
--     hex(SHA256(image_url)) ||
--     hex(SHA256(link_url))
--   )
-- Each field is individually hashed to a fixed 64-char hex string before
-- concatenation — no separator needed, no ambiguity.

CREATE OR REPLACE FUNCTION create_message_receipt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.message_receipts (content_hash, room, created_at)
  VALUES (
    extensions.digest(
      encode(extensions.digest(COALESCE(NEW.content,   ''), 'sha256'), 'hex') ||
      encode(extensions.digest(COALESCE(NEW.image_url, ''), 'sha256'), 'hex') ||
      encode(extensions.digest(COALESCE(NEW.link_url,  ''), 'sha256'), 'hex'),
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
  msg             RECORD;
  receipt         RECORD;
  report_count    INT;
  existing_report UUID;
  new_report_id   UUID;
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
  WHERE reporter_id      = auth.uid()
    AND message_content    IS NOT DISTINCT FROM msg.content
    AND message_image_url  IS NOT DISTINCT FROM msg.image_url
    AND message_room       = msg.room
    AND message_created_at = msg.created_at;

  IF FOUND THEN
    RAISE EXCEPTION 'you have already reported this message';
  END IF;

  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash = extensions.digest(
      encode(extensions.digest(COALESCE(msg.content,   ''), 'sha256'), 'hex') ||
      encode(extensions.digest(COALESCE(msg.image_url, ''), 'sha256'), 'hex') ||
      encode(extensions.digest(COALESCE(msg.link_url,  ''), 'sha256'), 'hex'),
      'sha256'
    )
    AND r.room       = msg.room
    AND r.created_at = msg.created_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'integrity error: no receipt found for this message';
  END IF;

  INSERT INTO public.moderation_reports (
    receipt_id, reporter_id, reason,
    message_content, message_image_url, message_link_url,
    message_author_id, message_room, message_created_at
  ) VALUES (
    receipt.id, auth.uid(), report_reason,
    msg.content, msg.image_url, msg.link_url,
    msg.profile_id, msg.room, msg.created_at
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions';
