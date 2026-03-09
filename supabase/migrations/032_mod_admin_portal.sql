-- ============================================
-- Migration 032: Moderation & Admin Portal
-- ============================================
-- Adds:
--   - user_bans table with RLS
--   - ban_user(), lift_ban(), get_active_bans()         (moderator+)
--   - get_all_reports() with pseudonyms resolved         (moderator+)
--   - resolve_report_moderated()                         (moderator+)
--   - get_platform_overview()                            (admin+)
--   - get_login_activity(), get_message_activity()       (admin+)
--   - get_user_roles()                                   (admin+)
-- ============================================

-- ============================================
-- 1. USER BANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_bans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ban_type     TEXT        NOT NULL CHECK (ban_type IN ('timeout', 'permanent')),
  reason       TEXT,
  banned_by    UUID        NOT NULL REFERENCES public.profiles(id),
  banned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  lifted_at    TIMESTAMPTZ,
  lifted_by    UUID        REFERENCES public.profiles(id),
  CONSTRAINT timeout_requires_expiry CHECK (
    ban_type != 'timeout' OR expires_at IS NOT NULL
  )
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- Moderators and admins can read all bans
CREATE POLICY "Moderators can read bans"
  ON public.user_bans FOR SELECT
  TO authenticated
  USING (public.is_moderator());

-- Moderators can update (lift) bans
CREATE POLICY "Moderators can update bans"
  ON public.user_bans FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- No direct INSERT — all inserts go through ban_user() SECURITY DEFINER

-- ============================================
-- 2. BAN USER (moderator+)
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
  -- Prevent self-ban
  IF target_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot ban yourself';
  END IF;

  INSERT INTO public.user_bans (profile_id, ban_type, reason, banned_by, expires_at)
  VALUES (target_profile_id, p_ban_type, p_reason, auth.uid(), p_expires_at)
  RETURNING id INTO new_ban_id;

  RETURN new_ban_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.ban_user(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- ============================================
-- 3. LIFT BAN (moderator+)
-- ============================================

CREATE OR REPLACE FUNCTION public.lift_ban(p_ban_id UUID)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient permissions: moderator role required';
  END IF;

  UPDATE public.user_bans
  SET lifted_at = NOW(), lifted_by = auth.uid()
  WHERE id = p_ban_id AND lifted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ban not found or already lifted';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.lift_ban(UUID) TO authenticated;

-- ============================================
-- 4. GET ACTIVE BANS (moderator+)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_active_bans()
RETURNS TABLE (
  id                  UUID,
  profile_id          UUID,
  pseudonym           TEXT,
  ban_type            TEXT,
  reason              TEXT,
  banned_at           TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  banned_by_pseudonym TEXT
) AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient permissions: moderator role required';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.profile_id,
    p.pseudonym,
    b.ban_type,
    b.reason,
    b.banned_at,
    b.expires_at,
    bp.pseudonym AS banned_by_pseudonym
  FROM public.user_bans b
  JOIN public.profiles p  ON p.id = b.profile_id
  JOIN public.profiles bp ON bp.id = b.banned_by
  WHERE b.lifted_at IS NULL
    AND (b.expires_at IS NULL OR b.expires_at > NOW())
  ORDER BY b.banned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_active_bans() TO authenticated;

-- ============================================
-- 5. GET ALL REPORTS WITH PSEUDONYMS (moderator+)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_reports()
RETURNS TABLE (
  id                        UUID,
  receipt_id                UUID,
  reporter_pseudonym        TEXT,
  reason                    TEXT,
  message_content           TEXT,
  message_image_url         TEXT,
  message_link_url          TEXT,
  message_author_pseudonym  TEXT,
  message_author_profile_id UUID,
  message_room              TEXT,
  message_created_at        TIMESTAMPTZ,
  reported_at               TIMESTAMPTZ,
  status                    TEXT,
  resolved_at               TIMESTAMPTZ,
  resolution_notes          TEXT,
  expires_at                TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient permissions: moderator role required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.receipt_id,
    COALESCE(rp.pseudonym, '[deleted]') AS reporter_pseudonym,
    r.reason,
    r.message_content,
    r.message_image_url,
    r.message_link_url,
    COALESCE(ap.pseudonym, '[deleted]') AS message_author_pseudonym,
    r.message_author_id AS message_author_profile_id,
    r.message_room::TEXT,
    r.message_created_at,
    r.reported_at,
    r.status::TEXT,
    r.resolved_at,
    r.resolution_notes,
    r.expires_at
  FROM public.moderation_reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles ap ON ap.id = r.message_author_id
  ORDER BY
    CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
    r.reported_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_all_reports() TO authenticated;

-- ============================================
-- 6. RESOLVE REPORT (moderator+)
-- ============================================

CREATE OR REPLACE FUNCTION public.resolve_report_moderated(
  p_report_id  UUID,
  p_new_status TEXT,
  p_notes      TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient permissions: moderator role required';
  END IF;
  IF p_new_status NOT IN ('reviewed', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'invalid status: must be reviewed, actioned, or dismissed';
  END IF;

  UPDATE public.moderation_reports
  SET
    status           = p_new_status::public.moderation_report_status,
    resolved_at      = NOW(),
    resolved_by      = auth.uid(),
    resolution_notes = p_notes
  WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.resolve_report_moderated(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- 7. PLATFORM OVERVIEW (admin+)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_platform_overview()
RETURNS TABLE (
  total_members   BIGINT,
  active_sessions BIGINT,
  pending_reports BIGINT,
  active_bans     BIGINT,
  messages_24h    BIGINT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'insufficient permissions: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)             FROM public.profiles)::BIGINT,
    (SELECT COUNT(DISTINCT user_id)
       FROM auth.sessions
      WHERE not_after IS NULL OR not_after > NOW())::BIGINT,
    (SELECT COUNT(*)             FROM public.moderation_reports
      WHERE status = 'pending')::BIGINT,
    (SELECT COUNT(*)             FROM public.user_bans
      WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))::BIGINT,
    (SELECT COUNT(*)             FROM public.message_receipts
      WHERE created_at >= NOW() - INTERVAL '24 hours')::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_platform_overview() TO authenticated;

-- ============================================
-- 8. LOGIN ACTIVITY BY DAY (admin+)
-- Counts unique users who triggered a login event per day.
-- Queries auth.audit_log_entries — admin only, aggregate only.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_login_activity(p_days_back INT DEFAULT 30)
RETURNS TABLE (day DATE, login_count BIGINT) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'insufficient permissions: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    DATE(e.created_at)                              AS day,
    COUNT(DISTINCT (e.payload->>'actor_id'))::BIGINT AS login_count
  FROM auth.audit_log_entries e
  WHERE e.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
    AND e.payload->>'action' = 'login'
  GROUP BY DATE(e.created_at)
  ORDER BY day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_login_activity(INT) TO authenticated;

-- ============================================
-- 9. MESSAGE ACTIVITY BY DAY (admin+)
-- Queries message_receipts which persist beyond the 72-hour TTL.
-- Returns aggregate counts only — no content, no author.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_message_activity(p_days_back INT DEFAULT 30)
RETURNS TABLE (day DATE, message_count BIGINT) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'insufficient permissions: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    DATE(mr.created_at)  AS day,
    COUNT(*)::BIGINT     AS message_count
  FROM public.message_receipts mr
  WHERE mr.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY DATE(mr.created_at)
  ORDER BY day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_message_activity(INT) TO authenticated;

-- ============================================
-- 10. GET USER ROLES (admin+)
-- Returns profile_id (= auth user id) so admin can call assign_role().
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TABLE (
  profile_id    UUID,
  pseudonym     TEXT,
  role          TEXT,
  member_since  TIMESTAMPTZ,
  message_count INTEGER
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'insufficient permissions: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id                                                        AS profile_id,
    p.pseudonym,
    COALESCE(u.raw_app_meta_data->>'role', 'member')            AS role,
    p.created_at                                                AS member_since,
    p.message_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY
    CASE COALESCE(u.raw_app_meta_data->>'role', 'member')
      WHEN 'admin'     THEN 0
      WHEN 'moderator' THEN 1
      ELSE                  2
    END,
    p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;
