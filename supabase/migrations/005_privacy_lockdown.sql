-- ============================================
-- Privacy lockdown
-- ============================================
-- Problem: current RLS lets any authenticated user read
-- ALL profiles and ALL snapshots. This means someone could
-- enumerate individual salary/role data.
--
-- Fix: lock profiles and snapshots to own-row-only for
-- direct SELECT. Expose only anonymised aggregates via
-- SECURITY DEFINER functions. Provide a minimal identity
-- view for chat (pseudonym only, no work data).
-- ============================================

-- ============================================
-- 1. PROFILES — restrict to own row only
-- ============================================

-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Users can only read their OWN full profile
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ============================================
-- 2. CHAT IDENTITIES — minimal view for chat
-- ============================================
-- This view only exposes id and pseudonym.
-- Used by chat to show who sent a message.
-- SECURITY INVOKER is fine here because we'll create
-- a function to look up identities.

CREATE OR REPLACE FUNCTION get_pseudonym(user_id UUID)
RETURNS TEXT AS $$
  SELECT pseudonym FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================
-- 3. PROFILE SNAPSHOTS — restrict to own rows
-- ============================================

DROP POLICY IF EXISTS "Snapshots are viewable by authenticated users" ON public.profile_snapshots;

-- Users can only see their own history
CREATE POLICY "Users can read their own snapshots"
  ON public.profile_snapshots FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ============================================
-- 4. ANONYMISED AGGREGATE FUNCTIONS
-- ============================================
-- These run as SECURITY DEFINER so they can read all
-- profiles/snapshots, but only return aggregate counts.
-- No individual data is ever exposed.

-- Current community snapshot (live profiles)
CREATE OR REPLACE FUNCTION get_salary_distribution()
RETURNS TABLE(salary_band salary_band, count BIGINT) AS $$
  SELECT p.salary_band, count(*)
  FROM public.profiles p
  WHERE p.salary_band IS NOT NULL
    AND p.onboarding_complete = true
  GROUP BY p.salary_band
  ORDER BY p.salary_band;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_role_distribution()
RETURNS TABLE(role_title role_title, count BIGINT) AS $$
  SELECT p.role_title, count(*)
  FROM public.profiles p
  WHERE p.role_title IS NOT NULL
    AND p.onboarding_complete = true
  GROUP BY p.role_title
  ORDER BY count(*) DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_experience_distribution()
RETURNS TABLE(experience_band experience_band, count BIGINT) AS $$
  SELECT p.experience_band, count(*)
  FROM public.profiles p
  WHERE p.experience_band IS NOT NULL
    AND p.onboarding_complete = true
  GROUP BY p.experience_band
  ORDER BY p.experience_band;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_wfh_distribution()
RETURNS TABLE(wfh_status wfh_status, count BIGINT) AS $$
  SELECT p.wfh_status, count(*)
  FROM public.profiles p
  WHERE p.wfh_status IS NOT NULL
    AND p.onboarding_complete = true
  GROUP BY p.wfh_status
  ORDER BY p.wfh_status;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_employment_distribution()
RETURNS TABLE(employment_type employment_type, count BIGINT) AS $$
  SELECT p.employment_type, count(*)
  FROM public.profiles p
  WHERE p.employment_type IS NOT NULL
    AND p.onboarding_complete = true
  GROUP BY p.employment_type
  ORDER BY count(*) DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_community_summary()
RETURNS TABLE(total_members BIGINT, total_with_data BIGINT) AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE onboarding_complete = true)
  FROM public.profiles;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Historical aggregates (from snapshots)
CREATE OR REPLACE FUNCTION get_salary_trend()
RETURNS TABLE(month TIMESTAMPTZ, salary_band salary_band, count BIGINT) AS $$
  SELECT
    date_trunc('month', s.captured_at),
    s.salary_band,
    count(*)
  FROM public.profile_snapshots s
  WHERE s.salary_band IS NOT NULL
  GROUP BY 1, s.salary_band
  ORDER BY 1 DESC, s.salary_band;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_wfh_trend()
RETURNS TABLE(month TIMESTAMPTZ, wfh_status wfh_status, count BIGINT) AS $$
  SELECT
    date_trunc('month', s.captured_at),
    s.wfh_status,
    count(*)
  FROM public.profile_snapshots s
  WHERE s.wfh_status IS NOT NULL
  GROUP BY 1, s.wfh_status
  ORDER BY 1 DESC, s.wfh_status;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================
-- 5. PSEUDONYM RENAME
-- ============================================
-- Allow users to choose a custom pseudonym.
-- Validated server-side: 3-24 chars, lowercase
-- alphanumeric + underscore only, must be unique.

CREATE OR REPLACE FUNCTION rename_pseudonym(new_name TEXT)
RETURNS TEXT AS $$
DECLARE
  clean_name TEXT;
BEGIN
  -- Normalize: lowercase, trim
  clean_name := lower(trim(new_name));

  -- Validate format
  IF clean_name !~ '^[a-z0-9][a-z0-9_]{1,22}[a-z0-9]$' THEN
    RAISE EXCEPTION 'invalid pseudonym: must be 3-24 characters, lowercase letters, numbers, and underscores only. cannot start or end with underscore.';
  END IF;

  -- Check uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE pseudonym = clean_name AND id != auth.uid()) THEN
    RAISE EXCEPTION 'pseudonym already taken';
  END IF;

  -- Update
  UPDATE public.profiles
  SET pseudonym = clean_name
  WHERE id = auth.uid();

  RETURN clean_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 6. Drop the old aggregate views (replaced by functions)
-- ============================================
DROP VIEW IF EXISTS monthly_salary_distribution;
DROP VIEW IF EXISTS monthly_wfh_distribution;
DROP VIEW IF EXISTS monthly_role_distribution;
