-- ============================================
-- Country field: enforce allowlist at DB level
-- ============================================
-- Finding #12: the country column is free-text with no validation. The
-- frontend uses a fixed dropdown, but a direct API call can set any string,
-- injecting misleading data into aggregate stats.
--
-- Add a CHECK constraint on both profiles and profile_snapshots to match
-- the three values in COUNTRY_OPTIONS (src/lib/constants.ts).
--
-- If the allowed country list expands, drop and re-add these constraints
-- in a new migration.
-- ============================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_valid_country
  CHECK (country IS NULL OR country IN ('Australia', 'New Zealand', 'Other'));

ALTER TABLE public.profile_snapshots
  ADD CONSTRAINT profile_snapshots_valid_country
  CHECK (country IS NULL OR country IN ('Australia', 'New Zealand', 'Other'));
