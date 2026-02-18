-- ============================================
-- Fix: snapshot triggers blocked by RLS
-- ============================================
-- Problem: The trigger functions that insert into profile_snapshots
-- run in the context of the user. After 005_privacy_lockdown added
-- RLS to profile_snapshots (with only a SELECT policy), the triggers
-- fail because there's no INSERT policy.
--
-- Solution: Make the trigger functions SECURITY DEFINER so they
-- bypass RLS. This is safe because:
-- 1. Triggers only fire on profile updates (already RLS-protected)
-- 2. Users can't call these functions directly
-- 3. The functions only insert snapshots for the row being updated
-- ============================================

-- Recreate the snapshot capture function with SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recreate the initial snapshot function with SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Note: The triggers themselves don't need to be recreated.
-- They will automatically use the updated function definitions.
