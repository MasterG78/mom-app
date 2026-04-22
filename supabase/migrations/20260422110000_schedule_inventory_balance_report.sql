-- Schedule Inventory Balance Report
-- Runs at 11:10 AM UTC on Mondays (6:10 AM ET)
-- This follows the trend report (11:05 AM UTC)

SELECT cron.schedule(
  'inventory-balance-report',
  '10 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/generate-inventory-balance-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
