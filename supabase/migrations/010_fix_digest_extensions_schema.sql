-- Fix digest() to use extensions schema (Supabase convention)
-- Or include extensions in search_path

CREATE OR REPLACE FUNCTION create_message_receipt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.message_receipts (content_hash, room, created_at)
  VALUES (
    extensions.digest(NEW.content, 'sha256'),
    NEW.room,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions';

-- Fix verify_message_authenticity function
CREATE OR REPLACE FUNCTION verify_message_authenticity(
  alleged_content TEXT,
  alleged_room TEXT,
  alleged_timestamp TIMESTAMPTZ
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
    WHERE content_hash = digest(alleged_content, 'sha256')
      AND room = alleged_room
      AND created_at = alleged_timestamp
  );
END;
$$;

-- Fix verify_report_against_receipt function  
CREATE OR REPLACE FUNCTION verify_report_against_receipt(report_id UUID)
RETURNS TABLE(
  receipt_exists BOOLEAN,
  hashes_match BOOLEAN,
  report_content TEXT,
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
    msg.content AS report_content,
    msg.created_at AS message_created_at,
    r.created_at AS receipt_created_at,
    (r.content_hash IS NOT NULL) AS has_receipt,
    (r.content_hash = digest(msg.content, 'sha256')) AS hash_matches
  INTO rec
  FROM moderation_reports msg
  LEFT JOIN message_receipts r
    ON r.content_hash = digest(msg.content, 'sha256')
    AND r.room = msg.room
    AND r.created_at = msg.created_at
  WHERE msg.id = report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report % not found', report_id;
  END IF;

  RETURN QUERY SELECT
    rec.has_receipt,
    rec.hash_matches,
    rec.report_content,
    rec.receipt_created_at;
END;
$$;
