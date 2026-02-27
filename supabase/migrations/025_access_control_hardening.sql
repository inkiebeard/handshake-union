-- ============================================
-- Access control hardening
-- ============================================
-- Two unrelated but similarly small access-control fixes:
--
-- 1. CUSTOM EMOTES — anon role had SELECT access via an "Anyone can read"
--    policy and a direct GRANT. There is no reason for unauthenticated
--    callers to fetch emotes. Revoke and restrict to authenticated only.
--
-- 2. COUNTRY FIELD — profiles.country and profile_snapshots.country are
--    free-text with no DB-level validation. The frontend uses a fixed
--    dropdown, but a direct API call can set any string, injecting
--    misleading data into aggregate stats. Add a CHECK constraint that
--    mirrors COUNTRY_OPTIONS in src/lib/constants.ts.
-- ============================================

-- ── Custom emotes ──────────────────────────────────────────────────────────

REVOKE SELECT ON public.custom_emotes FROM anon;

DROP POLICY IF EXISTS "Anyone can read enabled emotes" ON public.custom_emotes;

CREATE POLICY "Authenticated users can read enabled emotes"
  ON public.custom_emotes
  FOR SELECT
  TO authenticated
  USING (enabled = true);

-- ── Country field validation ───────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_valid_country
  CHECK (country IS NULL OR country IN ('Australia', 'New Zealand', 'Other'));

ALTER TABLE public.profile_snapshots
  ADD CONSTRAINT profile_snapshots_valid_country
  CHECK (country IS NULL OR country IN ('Australia', 'New Zealand', 'Other'));
