-- ============================================
-- Message rate limiting
-- ============================================
-- Prevents programmatic flooding of chat rooms. Three parts:
--
-- 1. INDEX — (profile_id, created_at DESC) so the trigger's window query
--    is O(log n) rather than a full table scan on every insert.
--
-- 2. TRIGGER — BEFORE INSERT, max 10 messages per 60 seconds per user.
--    Enforced at DB level; cannot be bypassed from the client.
--
--    Hardening applied vs a naive implementation:
--      - NEW.created_at is forced to now() before the window check so a
--        client cannot supply an old timestamp to evade the limit.
--      - pg_advisory_xact_lock serialises concurrent inserts for the same
--        user (e.g. multiple open tabs) so two transactions cannot both
--        read count < 10 before either commits. Lock is transaction-scoped
--        and safe with PgBouncer in transaction-mode pooling.
-- ============================================

-- ── Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_profile_created
  ON public.messages (profile_id, created_at DESC);

-- ── Rate-limit trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  msg_count INT;
BEGIN
  -- Force server-side timestamp so clients cannot spoof created_at to
  -- slip messages outside the rate-limit window.
  NEW.created_at := now();

  -- Serialise concurrent inserts for the same user.
  -- hashtext() → int4; cast to int8 for pg_advisory_xact_lock.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.profile_id::text)::bigint);

  SELECT count(*) INTO msg_count
  FROM public.messages
  WHERE profile_id = NEW.profile_id
    AND created_at > now() - interval '60 seconds';

  IF msg_count >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded: maximum 10 messages per minute';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER on_message_insert_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_message_rate_limit();
