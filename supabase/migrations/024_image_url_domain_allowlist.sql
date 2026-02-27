-- ============================================
-- Image URL allowlist: CDN domain constraint
-- ============================================
-- Replaces the open https:// CHECK added in migration 017 with a structured
-- CDN-allowlist regex that mirrors ALLOWED_IMAGE_PROVIDERS in
-- src/lib/constants.ts.
--
-- Pattern: ^https://(media[0-9]*|i|c)\.(giphy|tenor|imgur)\.com/
--   prefix  — media, media<N> (CDN shards), i, or c
--   domain  — approved second-level domain
--   tld     — pinned to .com (all three providers exclusively use .com CDN)
--
-- TLD is pinned to .com to prevent lookalike-domain bypasses (e.g. giphy.xyz).
-- To add a provider: extend the domain group AND update ALLOWED_IMAGE_PROVIDERS
-- in src/lib/constants.ts. A new migration is required for each change.
-- ============================================

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_image_url_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_image_url_check CHECK (
    image_url IS NULL OR (
      char_length(image_url) <= 2048
      AND image_url ~* '^https://(media[0-9]*|i|c)\.(giphy|tenor|imgur)\.com/'
    )
  );
