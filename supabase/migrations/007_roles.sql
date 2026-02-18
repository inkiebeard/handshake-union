-- ============================================
-- Role-Based Access Control
-- ============================================
-- Three-tier role system via JWT app_metadata claims:
--
--   member    (default) — chat, own profile, report messages, view stats
--   moderator (assigned) — + view/resolve moderation reports
--   admin     (assigned) — + verify receipts, assign roles, system dashboards
--
-- Roles stored in auth.users.raw_app_meta_data->>'role'
-- Checked in RLS via auth.jwt()->'app_metadata'->>'role'
--
-- Supabase service_role key bypasses RLS entirely and is
-- used for automated processes (crons, migrations, CI).
-- ============================================

-- ============================================
-- 1. ROLE HELPER FUNCTIONS
-- ============================================
-- Clean helpers so RLS policies stay readable.
-- These check the JWT claim, not a DB lookup — fast and stateless.

CREATE OR REPLACE FUNCTION is_moderator()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'role') IN ('moderator', 'admin'),
    false
  );
$$ LANGUAGE sql STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'role') = 'admin',
    false
  );
$$ LANGUAGE sql STABLE SET search_path = '';

-- ============================================
-- 2. SET DEFAULT ROLE ON SIGNUP
-- ============================================
-- Update the existing handle_new_user() trigger function
-- to also set app_metadata.role = 'member' on new signups.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile with auto-generated pseudonym
  INSERT INTO public.profiles (id, pseudonym)
  VALUES (NEW.id, public.generate_pseudonym());

  -- Set default role in app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || '{"role": "member"}'::jsonb
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Note: the trigger on_auth_user_created already exists from 001,
-- and it references handle_new_user() by name, so the CREATE OR REPLACE
-- above is sufficient — no need to recreate the trigger.

-- ============================================
-- 3. ROLE ASSIGNMENT FUNCTION (admin-only)
-- ============================================
-- Only admins can assign roles. Validates the target role
-- and updates raw_app_meta_data on the target user.

CREATE OR REPLACE FUNCTION assign_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'insufficient permissions: admin role required';
  END IF;

  -- Validate role value
  IF new_role NOT IN ('member', 'moderator', 'admin') THEN
    RAISE EXCEPTION 'invalid role: must be member, moderator, or admin';
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  -- Prevent removing your own admin role (safety)
  IF target_user_id = auth.uid() AND new_role != 'admin' THEN
    RAISE EXCEPTION 'cannot remove your own admin role — ask another admin';
  END IF;

  -- Update role in app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new_role)
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 4. VERIFY MESSAGE RECEIPT (admin-only)
-- ============================================
-- Takes alleged content + room + time window and checks
-- if a matching receipt exists. Returns boolean only —
-- no receipt data is ever exposed.

CREATE OR REPLACE FUNCTION verify_message_receipt(
  alleged_content TEXT,
  alleged_room chat_room,
  time_start TIMESTAMPTZ,
  time_end TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'insufficient permissions: admin role required';
  END IF;

  -- Validate time window (max 24 hours to prevent fishing)
  IF time_end - time_start > interval '24 hours' THEN
    RAISE EXCEPTION 'time window too large: maximum 24 hours';
  END IF;

  -- Search for a matching receipt
  RETURN EXISTS (
    SELECT 1
    FROM public.message_receipts
    WHERE content_hash = digest(alleged_content, 'sha256')
      AND room = alleged_room
      AND created_at >= time_start
      AND created_at <= time_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 5. ROLE-GATED RLS POLICIES FOR MODERATION REPORTS
-- ============================================
-- Replace the deny-all baseline from 006 with role-gated policies.

-- Drop the deny-all policy from 006
DROP POLICY IF EXISTS "No direct access to moderation reports" ON public.moderation_reports;

-- Moderators and admins can read all reports
CREATE POLICY "Moderators can read moderation reports"
  ON public.moderation_reports FOR SELECT
  TO authenticated
  USING (public.is_moderator());

-- Moderators and admins can update reports (resolve them)
CREATE POLICY "Moderators can update moderation reports"
  ON public.moderation_reports FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- Admins can delete reports (cleanup, legal requests)
CREATE POLICY "Admins can delete moderation reports"
  ON public.moderation_reports FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- No direct INSERT policy — all inserts go through report_message()
-- which runs as SECURITY DEFINER and bypasses RLS.

-- ============================================
-- 6. MESSAGE RECEIPTS RLS STAYS LOCKED
-- ============================================
-- The deny-all policy from 006 remains. No changes needed.
-- verify_message_receipt() runs as SECURITY DEFINER and
-- bypasses RLS to query receipts. No human ever SELECTs
-- from message_receipts directly.

-- ============================================
-- 7. BACKFILL ROLES FOR EXISTING USERS
-- ============================================
-- Set role = 'member' for any existing users who don't
-- have a role yet (signed up before this migration).

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "member"}'::jsonb
WHERE raw_app_meta_data->>'role' IS NULL;
