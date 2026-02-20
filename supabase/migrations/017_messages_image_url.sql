-- ============================================
-- Add image_url column to messages
-- ============================================
-- Optional image attachment: one URL per message, https only, max 2048 chars

ALTER TABLE public.messages
  ADD COLUMN image_url TEXT CHECK (
    image_url IS NULL OR (
      image_url ~ '^https://' AND char_length(image_url) <= 2048
    )
  );
