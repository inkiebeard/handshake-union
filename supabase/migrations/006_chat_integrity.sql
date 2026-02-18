-- ============================================
-- Chat Integrity: Cryptographic Receipts + Moderation Log
-- ============================================
-- Two systems working together:
--
-- 1. MESSAGE RECEIPTS — SHA-256 hash of every message, stored
--    automatically via trigger. No readable content, no author
--    identity. Proves content existed without retaining it.
--    Completely invisible to all user-facing roles.
--
-- 2. MODERATION REPORTS — content snapshot of reported messages,
--    linked to the corresponding receipt for tamper-evident
--    verification. Only populated when a user reports a message
--    (while it still exists). 30-day TTL, then hard-deleted.
--
-- Together these let the platform:
--   - Verify screenshots are real or fake (receipt hash check)
--   - Investigate reported content (moderation log)
--   - Cross-check reports against receipts (dispute resolution)
--   - Genuinely say "we don't store your messages beyond 1 hour"
-- ============================================

-- ============================================
-- 1. ENABLE PGCRYPTO
-- ============================================
-- Required for digest() function used in SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 2. MESSAGE RECEIPTS TABLE
-- ============================================
-- Stores a SHA-256 hash per message. No readable content,
-- no author identity. Author-blind by design.
--
-- RLS: deny ALL for authenticated role. Only writable via
-- SECURITY DEFINER trigger, only readable via admin-only
-- verify function (created in 007_roles.sql).

CREATE TABLE message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash BYTEA NOT NULL,
  room chat_room NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_receipts_hash ON message_receipts(content_hash);
CREATE INDEX idx_receipts_room_time ON message_receipts(room, created_at DESC);

-- RLS: lock down completely for authenticated users
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;

-- No policies = no access for authenticated role.
-- SECURITY DEFINER functions and service_role bypass RLS.
-- We add an explicit deny-all policy for clarity and defence in depth.
CREATE POLICY "No direct access to receipts"
  ON message_receipts FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================
-- 3. AUTO-RECEIPT TRIGGER
-- ============================================
-- Fires on every message INSERT. Creates a receipt with
-- SHA-256(content). Runs as SECURITY DEFINER to bypass
-- the RLS lockdown on message_receipts.

CREATE OR REPLACE FUNCTION create_message_receipt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.message_receipts (content_hash, room, created_at)
  VALUES (
    digest(NEW.content, 'sha256'),
    NEW.room,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_message_created_receipt
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_receipt();

-- ============================================
-- 4. MODERATION REPORTS TABLE
-- ============================================
-- Only populated via report_message() function.
-- Stores a content snapshot AND links to the receipt
-- for tamper-evident verification.
--
-- RLS: no direct access for members. Moderator+ can
-- SELECT and UPDATE (resolve). Policies gated by role
-- helper functions created in 007_roles.sql.
-- Until 007 runs, only service_role can access this table.

CREATE TABLE moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES message_receipts(id),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT CHECK (char_length(reason) <= 500),
  -- Snapshot of the reported message (machine-copied, not user-provided)
  message_content TEXT NOT NULL,
  message_author_id UUID NOT NULL,
  message_room chat_room NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  -- Report lifecycle
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  -- Hard expiry: 30 days from creation
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_mod_reports_status ON moderation_reports(status) WHERE status = 'pending';
CREATE INDEX idx_mod_reports_expires ON moderation_reports(expires_at);
CREATE INDEX idx_mod_reports_author ON moderation_reports(message_author_id);

-- RLS: lock down for now. Role-gated policies added in 007_roles.sql.
ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all baseline — 007_roles.sql will add role-gated policies
CREATE POLICY "No direct access to moderation reports"
  ON moderation_reports FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================
-- 5. REPORT MESSAGE FUNCTION — live reports only
-- ============================================
-- Any authenticated user can call this to report a message
-- that CURRENTLY EXISTS (within 1hr TTL). Content is machine-
-- copied from the messages table, never user-provided.
--
-- Links the report to its corresponding message receipt
-- for tamper-evident dispute resolution.
--
-- Rate-limited: max 10 reports per user per hour.
-- Duplicate prevention: same reporter + same message = error.

CREATE OR REPLACE FUNCTION report_message(
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

  -- Rate limit: max 10 reports per hour per user
  SELECT count(*) INTO report_count
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND reported_at > now() - interval '1 hour';

  IF report_count >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded: maximum 10 reports per hour';
  END IF;

  -- Look up the message — must still exist
  SELECT id, room, profile_id, content, created_at
  INTO msg
  FROM public.messages
  WHERE id = target_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found — it may have expired. use retrospective submission for messages older than 1 hour.';
  END IF;

  -- Prevent self-reporting
  IF msg.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot report your own message';
  END IF;

  -- Prevent duplicate reports (same reporter + same message content + same time)
  SELECT id INTO existing_report
  FROM public.moderation_reports
  WHERE reporter_id = auth.uid()
    AND message_content = msg.content
    AND message_room = msg.room
    AND message_created_at = msg.created_at;

  IF FOUND THEN
    RAISE EXCEPTION 'you have already reported this message';
  END IF;

  -- Find the matching receipt by content hash + room + timestamp
  SELECT r.id INTO receipt
  FROM public.message_receipts r
  WHERE r.content_hash = digest(msg.content, 'sha256')
    AND r.room = msg.room
    AND r.created_at = msg.created_at;

  IF NOT FOUND THEN
    -- This should never happen (trigger creates receipt on INSERT),
    -- but handle gracefully
    RAISE EXCEPTION 'integrity error: no receipt found for this message';
  END IF;

  -- Create the moderation report
  INSERT INTO public.moderation_reports (
    receipt_id,
    reporter_id,
    reason,
    message_content,
    message_author_id,
    message_room,
    message_created_at
  ) VALUES (
    receipt.id,
    auth.uid(),
    report_reason,
    msg.content,
    msg.profile_id,
    msg.room,
    msg.created_at
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 6. RESOLVE REPORT FUNCTION
-- ============================================
-- Moderator+ can resolve reports. Role check is done
-- via is_moderator() helper (created in 007_roles.sql).
-- Until 007 runs, only service_role can resolve reports.

CREATE OR REPLACE FUNCTION resolve_report(
  target_report_id UUID,
  new_status TEXT,
  notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Role check — is_moderator() created in 007_roles.sql.
  -- For now, check if the function exists; if not, deny access.
  -- This makes 006 safe to deploy before 007.
  BEGIN
    IF NOT public.is_moderator() THEN
      RAISE EXCEPTION 'insufficient permissions: moderator role required';
    END IF;
  EXCEPTION WHEN undefined_function THEN
    RAISE EXCEPTION 'role system not yet configured — deploy 007_roles.sql first';
  END;

  -- Validate status
  IF new_status NOT IN ('reviewed', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'invalid status: must be reviewed, actioned, or dismissed';
  END IF;

  -- Update the report
  UPDATE public.moderation_reports
  SET
    status = new_status,
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_notes = notes
  WHERE id = target_report_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report not found or already resolved';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 7. CLEANUP CRONS
-- ============================================
-- These require pg_cron extension enabled in Supabase.
-- Uncomment and run in the Supabase SQL editor if pg_cron
-- is available, or set up equivalent edge function crons.

-- Delete messages older than 1 hour (every 5 minutes)
-- SELECT cron.schedule(
--   'cleanup-old-messages',
--   '*/5 * * * *',
--   $$DELETE FROM public.messages WHERE created_at < now() - interval '1 hour'$$
-- );

-- Delete expired moderation reports (daily at 3am UTC)
-- SELECT cron.schedule(
--   'cleanup-expired-reports',
--   '0 3 * * *',
--   $$DELETE FROM public.moderation_reports WHERE expires_at < now()$$
-- );
