-- ============================================
-- Migration 036: Fix ban_user() and report_message()
-- ============================================
-- Two correctness bugs from migrations 034 and 035:
--
-- Fix 1 (034): ban_user() unconditionally overwrote banned_until with the
-- new ban's value. A shorter timeout ban issued after a permanent ban would
-- downgrade banned_until from 'infinity' to a future timestamp, allowing
-- the user to re-authenticate before the permanent ban was lifted.
-- Now we derive banned_until from ALL currently active bans (strongest wins).
--
-- Fix 2 (035): report_message() computed the receipt hash using '|'
-- separators between field digests. The actual receipt hash scheme
-- (create_message_receipt, migration 029+) concatenates without separators.
-- Reports against any message created after migration 029 would always
-- hit "integrity error: no receipt found". Also adds the legacy 2-field
-- fallback for receipts created before migration 029, and tightens
-- duplicate detection to use IS NOT DISTINCT FROM so NULL fields compare
-- correctly.
-- ============================================

-- ============================================
-- 1. ban_user() — preserve strongest active ban in banned_until
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

  -- Derive banned_until from ALL currently active bans for this user.
  -- A new shorter-lived ban must never downgrade a longer or permanent one.
  --   - Any active permanent ban (expires_at IS NULL) → 'infinity'
  --   - Otherwise → MAX(expires_at) across all active timeout bans
  UPDATE auth.users
  SET banned_until = (
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE expires_at IS NULL) > 0
        THEN 'infinity'::TIMESTAMPTZ
        ELSE MAX(expires_at)
      END
    FROM public.user_bans
    WHERE profile_id = target_profile_id
      AND lifted_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  )
  WHERE id = target_profile_id;

  RETURN new_ban_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.ban_user(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- ============================================
-- 2. moderation_reports.message_content — relax NOT NULL
-- ============================================
-- messages.content is nullable (image-only / link-only messages since migration 018).
-- The original NOT NULL constraint on message_content would cause report_message() to
-- fail when reporting such messages. Relax it to allow NULL consistently with the
-- frontend ModerationReport type (message_content: string | null).

ALTER TABLE public.moderation_reports
  ALTER COLUMN message_content DROP NOT NULL;

-- ============================================
-- 3. report_message() — correct hash scheme + legacy fallback
-- ============================================
-- Hash scheme: SHA256(hex(SHA256(f1)) || hex(SHA256(f2)) || ...) — no separators.
-- Also fixes NULL-safe duplicate detection via IS NOT DISTINCT FROM.

CREATE OR REPLACE FUNCTION public.report_message(
  target_message_id UUID,
  report_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  msg             RECORD;
  receipt         RECORD;
  report_count    INT;
  existing_report UUID;
  new_report_id   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Ban check — must be explicit because SECURITY DEFINER bypasses RLS
  IF public.is_banned() THEN
    RAISE EXCEPTION 'your account is currently banned';
  END IF;

  SELECT count(*) INTO report_count
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND reported_at > now() - interval '1 hour';

  IF report_count >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded: maximum 10 reports per hour';
  END IF;

  SELECT id, room, profile_id, content, image_url, link_url, created_at
  INTO msg
  FROM public.messages
  WHERE id = target_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found — it may have expired.';
  END IF;

  IF msg.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot report your own message';
  END IF;

  -- Include link_url so messages that share content/image but differ only in
  -- link_url are not incorrectly treated as duplicate reports.
  -- IS NOT DISTINCT FROM handles NULL fields correctly (NULL = NULL → true).
  SELECT id INTO existing_report
  FROM public.moderation_reports
  WHERE reporter_id      = auth.uid()
    AND message_content    IS NOT DISTINCT FROM msg.content
    AND message_image_url  IS NOT DISTINCT FROM msg.image_url
    AND message_link_url   IS NOT DISTINCT FROM msg.link_url
    AND message_room       = msg.room
    AND message_created_at = msg.created_at;

  IF FOUND THEN
    RAISE EXCEPTION 'you have already reported this message';
  END IF;

  -- Accept either the current 3-field hash or the legacy 2-field hash
  -- (content + image_url only, used by receipts created before migration 029).
  -- Hash scheme: SHA256(hex(SHA256(f1)) || hex(SHA256(f2)) || ...) — no separators.
  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash IN (
      -- Current 3-field hash (migration 029+)
      extensions.digest(
        encode(extensions.digest(COALESCE(msg.content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(msg.image_url, ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(msg.link_url,  ''), 'sha256'), 'hex'),
        'sha256'
      ),
      -- Legacy 2-field hash (pre-migration-029 receipts)
      extensions.digest(
        encode(extensions.digest(COALESCE(msg.content,   ''), 'sha256'), 'hex') ||
        encode(extensions.digest(COALESCE(msg.image_url, ''), 'sha256'), 'hex'),
        'sha256'
      )
    )
    AND r.room       = msg.room
    AND r.created_at = msg.created_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'integrity error: no receipt found for this message';
  END IF;

  INSERT INTO public.moderation_reports (
    receipt_id, reporter_id, reason,
    message_content, message_image_url, message_link_url,
    message_author_id, message_room, message_created_at
  ) VALUES (
    receipt.id, auth.uid(), report_reason,
    msg.content, msg.image_url, msg.link_url,
    msg.profile_id, msg.room, msg.created_at
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions';
