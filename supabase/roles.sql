-- ============================================================
-- Global extensions required before migrations run
-- ============================================================
-- This file is applied by `supabase db reset` and `supabase start`
-- BEFORE any numbered migration is applied.
--
-- On hosted Supabase, pg_cron is enabled via:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- That step also runs CREATE EXTENSION and sets shared_preload_libraries.
--
-- Locally, shared_preload_libraries is set in config.toml [db.settings]
-- and this file handles the CREATE EXTENSION so migration 015 (which
-- calls cron.schedule() directly) finds the cron schema ready.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
