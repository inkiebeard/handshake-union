-- ============================================
-- Pseudonym oracle guard
-- ============================================
-- get_pseudonym(uuid) was callable by any authenticated user with any UUID,
-- enabling cold enumeration: Known email → auth.users → UUID → pseudonym →
-- full chat history.
--
-- Two fixes applied together:
--
-- 1. QUERY GUARD — only return a pseudonym for a profile that has sent at
--    least one message. Active chat participants are still resolvable (required
--    for chat display). Accounts that have never chatted return NULL, breaking
--    the enumeration chain for inactive/new accounts.
--    Uses idx_messages_profile_created (migration 026) for the EXISTS check.
--
-- 2. EXECUTE GRANT — PostgreSQL grants EXECUTE to PUBLIC by default. For a
--    SECURITY DEFINER function exposed via Supabase's PostgREST API this means
--    the anon role (unauthenticated callers with the public anon key) could
--    call this RPC without logging in. Revoke from PUBLIC, grant to
--    authenticated only.
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

REVOKE EXECUTE ON FUNCTION public.get_pseudonym(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_pseudonym(UUID) TO authenticated;
