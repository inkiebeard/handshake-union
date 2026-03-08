-- ============================================
-- Update verify_message_authenticity to include link_url
-- ============================================
-- The receipt hash scheme (since migration 029) is:
--   SHA256( hex(SHA256(content)) || hex(SHA256(image_url)) || hex(SHA256(link_url)) )
-- This function was last updated in migration 021 with only content + image_url,
-- so it would return false for any message that has a link_url attached.

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
    WHERE content_hash = extensions.digest(
        encode(extensions.digest(COALESCE(alleged_content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(alleged_image_url, ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(alleged_link_url,  ''), 'sha256'), 'hex'),
        'sha256'
      )
      AND room       = alleged_room::chat_room
      AND created_at = alleged_timestamp
  );
END;
$$;
