-- ============================================
-- Custom emotes: restrict to authenticated users only
-- ============================================
-- Finding #10: the anon role could SELECT custom_emotes via the PostgREST
-- endpoint without any authentication. Custom emotes aren't sensitive data,
-- but there is no reason to expose any endpoint to unauthenticated requests.
--
-- 1. Revoke the anon SELECT grant added in 013_custom_emotes.sql
-- 2. Replace the "anyone" policy with an "authenticated" policy
-- ============================================

REVOKE SELECT ON public.custom_emotes FROM anon;

DROP POLICY IF EXISTS "Anyone can read enabled emotes" ON public.custom_emotes;

CREATE POLICY "Authenticated users can read enabled emotes"
  ON public.custom_emotes
  FOR SELECT
  TO authenticated
  USING (enabled = true);
