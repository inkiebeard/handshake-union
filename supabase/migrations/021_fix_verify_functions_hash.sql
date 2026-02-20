-- ============================================
-- Update verification functions to match the
-- double-SHA256 hash scheme from migration 020
-- ============================================
-- Both functions previously used digest(content, 'sha256').
-- Receipts are now stored as:
--   SHA256( hex(SHA256(content)) || hex(SHA256(image_url)) )
-- where missing fields are treated as empty string.

-- verify_message_authenticity: add image_url parameter (defaults to NULL
-- so existing callers that only pass content+room+timestamp still work for
-- text-only messages).
CREATE OR REPLACE FUNCTION verify_message_authenticity(
  alleged_content   TEXT,
  alleged_room      TEXT,
  alleged_timestamp TIMESTAMPTZ,
  alleged_image_url TEXT DEFAULT NULL
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
    WHERE content_hash = extensions.digest(
        encode(extensions.digest(COALESCE(alleged_content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(alleged_image_url, ''), 'sha256'), 'hex'),
        'sha256'
      )
      AND room       = alleged_room::chat_room
      AND created_at = alleged_timestamp
  );
END;
$$;

-- verify_report_against_receipt: drop and recreate because the return type
-- gains a new column (report_image_url); CREATE OR REPLACE cannot change return type.
DROP FUNCTION IF EXISTS verify_report_against_receipt(UUID);

CREATE OR REPLACE FUNCTION verify_report_against_receipt(report_id UUID)
RETURNS TABLE(
  receipt_exists    BOOLEAN,
  hashes_match      BOOLEAN,
  report_content    TEXT,
  report_image_url  TEXT,
  receipt_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  rec RECORD;
  expected_hash BYTEA;
BEGIN
  SELECT
    mr.message_content   AS report_content,
    mr.message_image_url AS report_image_url,
    mr.message_created_at,
    mr.message_room,
    r.created_at         AS receipt_created_at,
    (r.content_hash IS NOT NULL) AS has_receipt,
    (
      r.content_hash = extensions.digest(
        encode(extensions.digest(COALESCE(mr.message_content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(mr.message_image_url, ''), 'sha256'), 'hex'),
        'sha256'
      )
    ) AS hash_matches
  INTO rec
  FROM moderation_reports mr
  LEFT JOIN message_receipts r
    ON r.content_hash = extensions.digest(
        encode(extensions.digest(COALESCE(mr.message_content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(mr.message_image_url, ''), 'sha256'), 'hex'),
        'sha256'
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
    rec.receipt_created_at;
END;
$$;
