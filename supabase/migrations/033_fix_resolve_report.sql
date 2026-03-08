-- ============================================
-- Migration 033: Fix resolve_report_moderated
-- ============================================
-- Migration 032 incorrectly cast status as:
--   p_new_status::public.moderation_report_status
-- but moderation_reports.status is a TEXT column with a
-- CHECK constraint (no enum type exists). Drop the bad cast.
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
    status           = p_new_status,
    resolved_at      = NOW(),
    resolved_by      = auth.uid(),
    resolution_notes = p_notes
  WHERE id = p_report_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report not found or already resolved';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.resolve_report_moderated(UUID, TEXT, TEXT) TO authenticated;
