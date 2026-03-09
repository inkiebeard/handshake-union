-- ============================================
-- Migration 034: Wire user_bans to auth.users.banned_until
-- ============================================
-- The ban_user() and lift_ban() functions in 032 only wrote to
-- public.user_bans — they had no effect on authentication.
-- Supabase Auth enforces bans via auth.users.banned_until:
--   - future timestamp  → sign-in rejected, token refresh blocked
--   - 'infinity'        → permanent ban
--   - NULL / past date  → not banned
--
-- This migration replaces both functions to also sync banned_until,
-- so bans take effect at the session level, not just as records.
-- ============================================

-- ============================================
-- 1. ban_user — now also sets auth.users.banned_until
-- ============================================

CREATE OR REPLACE FUNCTION public.ban_user(
  target_profile_id UUID,
  p_ban_type        TEXT,
  p_reason          TEXT        DEFAULT NULL,
  p_expires_at      TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_ban_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient permissions: moderator role required';
  END IF;
  IF p_ban_type NOT IN ('timeout', 'permanent') THEN
    RAISE EXCEPTION 'invalid ban_type: must be timeout or permanent';
  END IF;
  IF p_ban_type = 'timeout' AND p_expires_at IS NULL THEN
    RAISE EXCEPTION 'timeout ban requires p_expires_at';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id) THEN
    RAISE EXCEPTION 'profile not found';
  END IF;
  IF target_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot ban yourself';
  END IF;

  -- Record the ban
  INSERT INTO public.user_bans (profile_id, ban_type, reason, banned_by, expires_at)
  VALUES (target_profile_id, p_ban_type, p_reason, auth.uid(), p_expires_at)
  RETURNING id INTO new_ban_id;

  -- Enforce at the Auth layer so the session is actually blocked.
  -- 'infinity' = permanent; future timestamp = timeout.
  UPDATE auth.users
  SET banned_until = CASE
    WHEN p_ban_type = 'permanent' THEN 'infinity'::TIMESTAMPTZ
    ELSE p_expires_at
  END
  WHERE id = target_profile_id;

  RETURN new_ban_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.ban_user(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- ============================================
-- 2. lift_ban — now also clears auth.users.banned_until
-- ============================================

CREATE OR REPLACE FUNCTION public.lift_ban(p_ban_id UUID)
RETURNS VOID AS $$
DECLARE
  v_profile_id UUID;
  v_active_ban_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient permissions: moderator role required';
  END IF;

  -- Get the profile_id before updating
  SELECT profile_id INTO v_profile_id
  FROM public.user_bans
  WHERE id = p_ban_id AND lifted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ban not found or already lifted';
  END IF;

  -- Lift the ban record
  UPDATE public.user_bans
  SET lifted_at = NOW(), lifted_by = auth.uid()
  WHERE id = p_ban_id;

  -- Only clear banned_until if this user has no other active bans remaining.
  -- (A user could theoretically have a second overlapping ban from a different mod.)
  SELECT COUNT(*) INTO v_active_ban_count
  FROM public.user_bans
  WHERE profile_id = v_profile_id
    AND lifted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
    AND id != p_ban_id;

  IF v_active_ban_count = 0 THEN
    -- No remaining active bans — restore auth access.
    -- Set to epoch (distant past) which Supabase treats as not-banned.
    UPDATE auth.users
    SET banned_until = '1970-01-01 00:00:00+00'::TIMESTAMPTZ
    WHERE id = v_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.lift_ban(UUID) TO authenticated;
