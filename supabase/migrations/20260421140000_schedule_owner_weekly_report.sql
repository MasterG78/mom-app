-- Schedule Owner Weekly Trend Report
-- Runs at 11:05 AM UTC on Mondays (6:05 AM ET)
-- This follows the weekly inventory snapshot (00:05 UTC)

SELECT cron.schedule(
  'owner-weekly-trend-report',
  '5 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/generate-owner-weekly-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
