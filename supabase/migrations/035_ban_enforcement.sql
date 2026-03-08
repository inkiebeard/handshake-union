-- ============================================
-- Migration 035: Enforce bans on write operations
-- ============================================
-- The auth-level ban (migration 034) blocks sign-in and token
-- refresh, but a user's current JWT (up to 1 h TTL) can still
-- be used to write. This migration enforces bans at the DB layer
-- on every write path a banned user might reach:
--
--   messages    INSERT  — sending chat messages
--   reactions   INSERT  — adding reactions
--   profiles    UPDATE  — editing work profile
--   rename_pseudonym()  — changing pseudonym  (SECURITY DEFINER, bypasses RLS)
--   report_message()    — submitting reports   (SECURITY DEFINER, bypasses RLS)
--
-- All checks use the new is_banned() helper, which queries
-- public.user_bans for an active (unexpired + unlifted) ban.
-- ============================================

-- ============================================
-- 1. is_banned() helper
-- ============================================
-- Mirror of is_moderator() / is_admin() — checks the bans table,
-- not a JWT claim, since bans can expire mid-session.

CREATE OR REPLACE FUNCTION public.is_banned()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_bans
    WHERE profile_id = auth.uid()
      AND lifted_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$ LANGUAGE sql STABLE SET search_path = '';

-- ============================================
-- 2. messages INSERT — block banned users from sending
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    AND NOT public.is_banned()
  );

-- ============================================
-- 3. reactions INSERT — block banned users from reacting
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own reactions" ON public.reactions;

CREATE POLICY "Users can insert their own reactions"
  ON public.reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    AND NOT public.is_banned()
  );

-- ============================================
-- 4. profiles UPDATE — block banned users from editing profile
-- ============================================

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND NOT public.is_banned())
  WITH CHECK (auth.uid() = id AND NOT public.is_banned());

-- ============================================
-- 5. rename_pseudonym() — explicit check (SECURITY DEFINER bypasses RLS)
-- ============================================

CREATE OR REPLACE FUNCTION public.rename_pseudonym(new_name TEXT)
RETURNS TEXT AS $$
DECLARE
  clean_name TEXT;
BEGIN
  -- Ban check — must be explicit because SECURITY DEFINER bypasses RLS
  IF public.is_banned() THEN
    RAISE EXCEPTION 'your account is currently banned';
  END IF;

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
-- 6. report_message() — explicit check (SECURITY DEFINER bypasses RLS)
-- ============================================
-- Banned users should not be able to submit reports.
-- Re-create with ban check prepended; all other logic unchanged.

CREATE OR REPLACE FUNCTION public.report_message(
  target_message_id UUID,
  report_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  msg RECORD;
  receipt RECORD;
  report_count INT;
  existing_report UUID;
  new_report_id UUID;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Ban check — SECURITY DEFINER bypasses RLS so must be explicit
  IF public.is_banned() THEN
    RAISE EXCEPTION 'your account is currently banned';
  END IF;

  -- Rate limit: max 10 reports per hour per user
  SELECT count(*) INTO report_count
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND reported_at > now() - interval '1 hour';

  IF report_count >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded: maximum 10 reports per hour';
  END IF;

  -- Look up the message — must still exist
  SELECT id, room, profile_id, content, image_url, link_url, created_at
  INTO msg
  FROM public.messages
  WHERE id = target_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found — it may have expired';
  END IF;

  -- Prevent self-reporting
  IF msg.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot report your own message';
  END IF;

  -- Prevent duplicate reports
  SELECT id INTO existing_report
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND message_content = msg.content
    AND message_room = msg.room
    AND message_created_at = msg.created_at;

  IF FOUND THEN
    RAISE EXCEPTION 'you have already reported this message';
  END IF;

  -- Find the matching receipt
  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash = extensions.digest(
      encode(extensions.digest(COALESCE(msg.content,   ''), 'sha256'), 'hex') || '|' ||
      encode(extensions.digest(COALESCE(msg.image_url, ''), 'sha256'), 'hex') || '|' ||
      encode(extensions.digest(COALESCE(msg.link_url,  ''), 'sha256'), 'hex'),
      'sha256'
    )
    AND r.room = msg.room
    AND r.created_at = msg.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'integrity error: no receipt found for this message';
  END IF;

  -- Create the report
  INSERT INTO public.moderation_reports (
    receipt_id,
    reporter_id,
    reason,
    message_content,
    message_image_url,
    message_link_url,
    message_author_id,
    message_room,
    message_created_at
  ) VALUES (
    receipt.id,
    auth.uid(),
    report_reason,
    msg.content,
    msg.image_url,
    msg.link_url,
    msg.profile_id,
    msg.room,
    msg.created_at
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, extensions';
