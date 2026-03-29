-- Daily Production Report Email Schedule
-- Runs at 01:00 UTC daily = 20:00 ET (fixed UTC-5, ignoring DST per user request)

-- Enable required extensions (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the daily report
SELECT cron.schedule(
  'daily-production-report',       -- job name
  '0 1 * * 1,2,3,4,5',             -- 01:00 UTC Mon-Fri (= 20:00 ET Sun-Thu)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/generate-production-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
