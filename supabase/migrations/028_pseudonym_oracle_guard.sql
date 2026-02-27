-- ============================================
-- get_pseudonym(): break UUID enumeration oracle
-- ============================================
-- Finding #2: any authenticated user can call get_pseudonym(uuid) with any
-- arbitrary UUID and receive back the corresponding pseudonym. Combined with
-- a leaked or brute-forced UUID, this creates a full deanonymisation chain:
--
--   Known email → auth.users → UUID → get_pseudonym() → pseudonym → chat history
--
-- Fix: only return a pseudonym for a profile that has at least one message in
-- the messages table. This means:
--   - Active chat participants are still resolvable (required for chat display)
--   - Accounts that have never sent a message cannot be enumerated by UUID
--   - Cold UUID fishing against newly-created or inactive accounts returns NULL
--
-- Note: this does not rate-limit the function. If rate limiting becomes
-- necessary (e.g. targeted enumeration of known-active users), add a
-- pg_ratelimit wrapper or move pseudonym resolution into the message JOIN
-- query rather than a separate RPC call.
-- ============================================

CREATE OR REPLACE FUNCTION get_pseudonym(user_id UUID)
RETURNS TEXT AS $$
  SELECT pseudonym
  FROM public.profiles
  WHERE id = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages WHERE profile_id = user_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';
