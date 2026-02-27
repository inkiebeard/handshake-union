-- ============================================
-- Server-side message rate limiting
-- ============================================
-- Finding #7: no per-user rate limit on message inserts. A malicious
-- authenticated user can flood rooms programmatically — the only existing
-- constraint is the 2000-character content limit.
--
-- This BEFORE INSERT trigger rejects inserts when the same profile_id has
-- sent 10 or more messages within the last 60 seconds. The limit is enforced
-- at the DB level so it cannot be bypassed from the client.
--
-- Tuning:
--   - Adjust the interval or threshold in enforce_message_rate_limit() if
--     the limit proves too restrictive for normal use.
-- ============================================

CREATE OR REPLACE FUNCTION enforce_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  msg_count INT;
BEGIN
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
