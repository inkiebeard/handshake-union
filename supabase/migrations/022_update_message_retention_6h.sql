-- ============================================
-- Update message retention from 1 hour to 6 hours
-- ============================================
-- Reschedules the cleanup cron job and updates all functions
-- that reference the 1-hour message TTL window.

-- Drop the existing cleanup cron job and re-register with 6-hour interval.
SELECT cron.unschedule('cleanup-old-messages');

SELECT cron.schedule(
  'cleanup-old-messages',
  '*/5 * * * *',
  $$DELETE FROM public.messages WHERE created_at < now() - interval '6 hours'$$
);
