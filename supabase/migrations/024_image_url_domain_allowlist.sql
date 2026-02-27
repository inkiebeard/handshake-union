-- ============================================
-- Image URL allowlist: simplified regex
-- ============================================
-- Replaces the per-provider patterns from migrations 024/029/030 with a
-- single structured regex that mirrors ALLOWED_IMAGE_PROVIDERS in
-- src/lib/constants.ts.
--
-- Pattern: ^https://(media[0-9]*|i|c)\.(giphy|tenor|imgur)\.[a-z]{2,}/
--   prefix  — media, media<N>, i, or c
--   domain  — one of the approved second-level domains
--   tld     — any TLD (2+ letters: .com, .co, .io, .net, …)
--
-- To add a new provider: add the SLD to ALLOWED_IMAGE_PROVIDERS in
-- src/lib/constants.ts, then create a new migration that drops this
-- constraint and adds it back with the updated domain group.
-- ============================================

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_image_url_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_image_url_check CHECK (
    image_url IS NULL OR (
      char_length(image_url) <= 2048
      AND image_url ~* '^https://(media[0-9]*|i|c)\.(giphy|tenor|imgur)\.[a-z]{2,}/'
    )
  );
