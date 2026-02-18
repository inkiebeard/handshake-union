-- ============================================
-- Public Member Stats
-- ============================================
-- Adds public-safe metrics to profiles:
-- - message_count: lifetime messages sent (incremented on send, never decremented)
-- - Existing: created_at (membership tenure)
-- - Existing: onboarding_complete (profile filled out)
--
-- These are intentionally decoupled from receipts to maintain
-- the author-blind design of the receipt system.

-- ============================================
-- 1. Add message_count to profiles
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 2. Trigger to increment count on message INSERT
-- ============================================
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET message_count = message_count + 1
  WHERE id = NEW.profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_message_insert_increment_count ON public.messages;
CREATE TRIGGER on_message_insert_increment_count
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_message_count();

-- ============================================
-- 3. Backfill existing message counts from receipts
-- ============================================
-- Since receipts don't have profile_id, we count from messages table
-- (only captures messages still within 1hr window, but better than 0)
UPDATE public.profiles p
SET message_count = COALESCE(
  (SELECT COUNT(*) FROM public.messages m WHERE m.profile_id = p.id),
  0
);

-- ============================================
-- 4. Public member stats function
-- ============================================
-- Returns public-safe stats for all members.
-- Accessible to authenticated users only.

CREATE OR REPLACE FUNCTION get_public_member_stats()
RETURNS TABLE (
  pseudonym TEXT,
  member_since TIMESTAMPTZ,
  message_count INTEGER,
  profile_complete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.pseudonym,
    p.created_at AS member_since,
    p.message_count,
    p.onboarding_complete AS profile_complete
  FROM public.profiles p
  ORDER BY p.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_public_member_stats() TO authenticated;

-- ============================================
-- 5. Individual member lookup function
-- ============================================
-- Get stats for a single member by pseudonym

CREATE OR REPLACE FUNCTION get_member_stats(target_pseudonym TEXT)
RETURNS TABLE (
  pseudonym TEXT,
  member_since TIMESTAMPTZ,
  message_count INTEGER,
  profile_complete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.pseudonym,
    p.created_at AS member_since,
    p.message_count,
    p.onboarding_complete AS profile_complete
  FROM public.profiles p
  WHERE p.pseudonym = target_pseudonym
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION get_member_stats(TEXT) TO authenticated;
