-- ============================================
-- Legacy hash fallback + link_url duplicate detection
-- ============================================
-- Migration 029 introduced the 3-field receipt hash scheme
-- (content + image_url + link_url).  Any message created before 029 has a
-- receipt using the old 2-field scheme (content + image_url only).
--
-- This migration fixes three gaps:
--
--   1. report_message() — receipt lookup was 3-field only, so pre-029 messages
--      could not be reported ("integrity error: no receipt found").
--      Also adds message_link_url to the duplicate-report detection query so
--      that two messages with matching content/image but different link_urls
--      are treated as distinct reports.
--
--   2. verify_message_authenticity() — same 3-field-only issue; legacy receipts
--      now accepted via IN (...) fallback.
--
--   3. verify_report_against_receipt() — migration 021 defined this function
--      with the old 2-field hash.  Migration 030 updated verify_message_authenticity
--      but left this function stale.  Recreated here with:
--        - report_link_url added to the return type
--        - 3-field hash + legacy 2-field fallback in both the JOIN and hash_matches

-- ── 1. report_message ────────────────────────────────────────────────────────
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

  -- Include link_url so messages that share content/image but differ only in
  -- link_url are not incorrectly treated as duplicate reports.
  SELECT id INTO existing_report
  FROM public.moderation_reports
  WHERE reporter_id      = auth.uid()
    AND message_content    IS NOT DISTINCT FROM msg.content
    AND message_image_url  IS NOT DISTINCT FROM msg.image_url
    AND message_link_url   IS NOT DISTINCT FROM msg.link_url
    AND message_room       = msg.room
    AND message_created_at = msg.created_at;

  IF FOUND THEN
    RAISE EXCEPTION 'you have already reported this message';
  END IF;

  -- Accept either the current 3-field hash or the legacy 2-field hash
  -- (content + image_url only, used by receipts created before migration 029).
  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash IN (
      extensions.digest(
        encode(extensions.digest(COALESCE(msg.content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(msg.image_url, ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(msg.link_url,  ''), 'sha256'), 'hex'),
        'sha256'
      ),
      -- Legacy 2-field hash (pre-migration-029 receipts)
      extensions.digest(
        encode(extensions.digest(COALESCE(msg.content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(msg.image_url, ''), 'sha256'), 'hex'),
        'sha256'
      )
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

-- ── 2. verify_message_authenticity ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_message_authenticity(
  alleged_content   TEXT,
  alleged_room      TEXT,
  alleged_timestamp TIMESTAMPTZ,
  alleged_image_url TEXT DEFAULT NULL,
  alleged_link_url  TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM message_receipts
    WHERE content_hash IN (
        -- Current 3-field hash (migration 029+)
        extensions.digest(
          encode(extensions.digest(COALESCE(alleged_content,   ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(alleged_image_url, ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(alleged_link_url,  ''), 'sha256'), 'hex'),
          'sha256'
        ),
        -- Legacy 2-field hash (pre-migration-029 receipts)
        extensions.digest(
          encode(extensions.digest(COALESCE(alleged_content,   ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(alleged_image_url, ''), 'sha256'), 'hex'),
          'sha256'
        )
      )
      AND room       = alleged_room::chat_room
      AND created_at = alleged_timestamp
  );
END;
$$;

-- ── 3. verify_report_against_receipt ─────────────────────────────────────────
-- Drop and recreate: return type gains report_link_url; hash logic updated to
-- accept both 3-field (current) and 2-field (legacy) schemes.
DROP FUNCTION IF EXISTS verify_report_against_receipt(UUID);

CREATE OR REPLACE FUNCTION verify_report_against_receipt(report_id UUID)
RETURNS TABLE(
  receipt_exists     BOOLEAN,
  hashes_match       BOOLEAN,
  report_content     TEXT,
  report_image_url   TEXT,
  report_link_url    TEXT,
  receipt_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT
    mr.message_content   AS report_content,
    mr.message_image_url AS report_image_url,
    mr.message_link_url  AS report_link_url,
    mr.message_created_at,
    mr.message_room,
    r.created_at         AS receipt_created_at,
    (r.content_hash IS NOT NULL) AS has_receipt,
    (
      r.content_hash IN (
        -- Current 3-field hash
        extensions.digest(
          encode(extensions.digest(COALESCE(mr.message_content,   ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(mr.message_image_url, ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(mr.message_link_url,  ''), 'sha256'), 'hex'),
          'sha256'
        ),
        -- Legacy 2-field hash (pre-migration-029 receipts)
        extensions.digest(
          encode(extensions.digest(COALESCE(mr.message_content,   ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(mr.message_image_url, ''), 'sha256'), 'hex'),
          'sha256'
        )
      )
    ) AS hash_matches
  INTO rec
  FROM moderation_reports mr
  LEFT JOIN message_receipts r
    ON r.content_hash IN (
        -- Current 3-field hash
        extensions.digest(
          encode(extensions.digest(COALESCE(mr.message_content,   ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(mr.message_image_url, ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(mr.message_link_url,  ''), 'sha256'), 'hex'),
          'sha256'
        ),
        -- Legacy 2-field hash (pre-migration-029 receipts)
        extensions.digest(
          encode(extensions.digest(COALESCE(mr.message_content,   ''), 'sha256'), 'hex') ||
          encode(extensions.digest(COALESCE(mr.message_image_url, ''), 'sha256'), 'hex'),
          'sha256'
        )
      )
    AND r.room       = mr.message_room
    AND r.created_at = mr.message_created_at
  WHERE mr.id = report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report % not found', report_id;
  END IF;

  RETURN QUERY SELECT
    rec.has_receipt,
    rec.hash_matches,
    rec.report_content,
    rec.report_image_url,
    rec.report_link_url,
    rec.receipt_created_at;
END;
$$;
