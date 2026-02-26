-- ============================================
-- Update message retention from 6 hours to 72 hours
-- ============================================
-- Reschedules the cleanup cron job that enforces the message
-- TTL/retention window, updating the threshold from 6 hours to 72 hours.

-- Drop the existing cleanup cron job and re-register it with the same
-- 5-minute schedule, but a 72-hour deletion/retention window.
SELECT cron.unschedule('cleanup-old-messages');

SELECT cron.schedule(
  'cleanup-old-messages',
  '*/5 * * * *',
  $$DELETE FROM public.messages WHERE created_at < now() - interval '72 hours'$$
);
