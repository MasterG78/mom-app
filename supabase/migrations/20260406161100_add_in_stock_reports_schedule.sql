-- 6:00 AM ET (UTC-5) = 11:00 AM UTC
-- Schedule for Mondays
SELECT cron.schedule(
  'monday-in-stock-report',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/generate-production-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"report_type": "in-stock-valuation"}'::jsonb
  );
  $$
);

-- Schedule for 1st of each month
SELECT cron.schedule(
  'monthly-in-stock-report',
  '0 11 1 * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/generate-production-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"report_type": "in-stock-valuation"}'::jsonb
  );
  $$
);
