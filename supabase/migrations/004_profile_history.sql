-- ============================================
-- Profile history — track member changes over time
-- ============================================
-- A snapshot is captured whenever a user updates their
-- work-related profile fields. This lets us build
-- time-series aggregates: salary trends, WFH shifts,
-- role movements, etc.
--
-- We snapshot the FULL set of work fields each time,
-- not individual field diffs, because aggregate queries
-- are much simpler when each row is a complete state.

CREATE TABLE profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Point-in-time copy of work fields
  salary_band salary_band,
  experience_band experience_band,
  employment_type employment_type,
  wfh_status wfh_status,
  role_title role_title,
  country TEXT,
  requires_visa BOOLEAN,
  -- When this snapshot was taken
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_snapshots_profile ON profile_snapshots(profile_id, captured_at DESC);
CREATE INDEX idx_snapshots_time ON profile_snapshots(captured_at DESC);

-- ============================================
-- Trigger: auto-capture snapshot on profile update
-- Only fires when work-related fields actually change
-- ============================================

CREATE OR REPLACE FUNCTION capture_profile_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Only snapshot if at least one work field changed
  IF (
    OLD.salary_band IS DISTINCT FROM NEW.salary_band OR
    OLD.experience_band IS DISTINCT FROM NEW.experience_band OR
    OLD.employment_type IS DISTINCT FROM NEW.employment_type OR
    OLD.wfh_status IS DISTINCT FROM NEW.wfh_status OR
    OLD.role_title IS DISTINCT FROM NEW.role_title OR
    OLD.country IS DISTINCT FROM NEW.country OR
    OLD.requires_visa IS DISTINCT FROM NEW.requires_visa
  ) THEN
    INSERT INTO public.profile_snapshots (
      profile_id,
      salary_band,
      experience_band,
      employment_type,
      wfh_status,
      role_title,
      country,
      requires_visa
    ) VALUES (
      NEW.id,
      NEW.salary_band,
      NEW.experience_band,
      NEW.employment_type,
      NEW.wfh_status,
      NEW.role_title,
      NEW.country,
      NEW.requires_visa
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER on_profile_work_fields_changed
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION capture_profile_snapshot();

-- Also capture the initial state when onboarding completes
-- (i.e., the first time they fill in data)
CREATE OR REPLACE FUNCTION capture_initial_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when onboarding just completed and there's actual data
  IF (
    OLD.onboarding_complete = false AND
    NEW.onboarding_complete = true AND
    (
      NEW.salary_band IS NOT NULL OR
      NEW.experience_band IS NOT NULL OR
      NEW.employment_type IS NOT NULL OR
      NEW.wfh_status IS NOT NULL OR
      NEW.role_title IS NOT NULL OR
      NEW.country IS NOT NULL
    )
  ) THEN
    INSERT INTO public.profile_snapshots (
      profile_id,
      salary_band,
      experience_band,
      employment_type,
      wfh_status,
      role_title,
      country,
      requires_visa
    ) VALUES (
      NEW.id,
      NEW.salary_band,
      NEW.experience_band,
      NEW.employment_type,
      NEW.wfh_status,
      NEW.role_title,
      NEW.country,
      NEW.requires_visa
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- This trigger runs BEFORE the change trigger, so initial onboarding
-- doesn't double-snapshot (the change trigger fires on field diffs,
-- initial trigger fires on onboarding_complete flip)
CREATE TRIGGER on_profile_onboarding_complete
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.onboarding_complete = false AND NEW.onboarding_complete = true)
  EXECUTE FUNCTION capture_initial_snapshot();

-- ============================================
-- RLS: snapshots are read-only for authenticated users
-- (nobody can insert/update/delete directly)
-- ============================================
ALTER TABLE profile_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots are viewable by authenticated users"
  ON profile_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Useful aggregate views for the stats dashboard
-- ============================================

-- Monthly salary distribution
CREATE OR REPLACE VIEW monthly_salary_distribution AS
SELECT
  date_trunc('month', captured_at) AS month,
  salary_band,
  count(*) AS count
FROM public.profile_snapshots
WHERE salary_band IS NOT NULL
GROUP BY month, salary_band
ORDER BY month DESC, salary_band;

-- Monthly WFH distribution
CREATE OR REPLACE VIEW monthly_wfh_distribution AS
SELECT
  date_trunc('month', captured_at) AS month,
  wfh_status,
  count(*) AS count
FROM public.profile_snapshots
WHERE wfh_status IS NOT NULL
GROUP BY month, wfh_status
ORDER BY month DESC, wfh_status;

-- Monthly role distribution
CREATE OR REPLACE VIEW monthly_role_distribution AS
SELECT
  date_trunc('month', captured_at) AS month,
  role_title,
  count(*) AS count
FROM public.profile_snapshots
WHERE role_title IS NOT NULL
GROUP BY month, role_title
ORDER BY month DESC, role_title;
