-- ============================================
-- Enable pg_cron cleanup jobs
-- ============================================
-- Requires pg_cron extension to be enabled in Supabase Dashboard first:
-- Database → Extensions → pg_cron → Enable

-- ============================================
-- Message cleanup (1 hour TTL)
-- ============================================
-- Runs every 5 minutes, deletes messages older than 1 hour.
-- Receipts are preserved indefinitely in message_receipts table.

SELECT cron.schedule(
  'cleanup-old-messages',
  '*/5 * * * *',
  $$DELETE FROM public.messages WHERE created_at < now() - interval '1 hour'$$
);

-- ============================================
-- Moderation report cleanup (30 day TTL)
-- ============================================
-- Runs daily at 3am UTC, deletes expired moderation reports.
-- Receipts are preserved indefinitely.

SELECT cron.schedule(
  'cleanup-expired-reports',
  '0 3 * * *',
  $$DELETE FROM public.moderation_reports WHERE expires_at < now()$$
);

-- ============================================
-- One-time cleanup of existing old messages
-- ============================================
-- Remove any messages that have accumulated before cron was enabled.

DELETE FROM public.messages WHERE created_at < now() - interval '1 hour';
