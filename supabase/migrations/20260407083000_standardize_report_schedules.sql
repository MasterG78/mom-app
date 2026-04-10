-- Standardize and fix automated report schedules (Job 5, 6, 7)
-- Uses dynamic Vault lookups instead of hardcoded key/url

-- 1. Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Cleanup existing jobs to ensure clean state
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-production-report') THEN
        PERFORM cron.unschedule('daily-production-report');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monday-in-stock-report') THEN
        PERFORM cron.unschedule('monday-in-stock-report');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-in-stock-report') THEN
        PERFORM cron.unschedule('monthly-in-stock-report');
    END IF;
END $$;

-- 3. Schedule Daily Production Report
-- Runs at 01:00 UTC Mon-Fri (= 21:00 ET Sun-Thu)
SELECT cron.schedule(
  'daily-production-report',
  '0 1 * * 1,2,3,4,5',
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

-- 4. Schedule Monday In-Stock Report
-- 6:00 AM ET (UTC-5) = 11:00 AM UTC on Mondays
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

-- 5. Schedule Monthly In-Stock Report
-- 6:00 AM ET (UTC-5) = 11:00 AM UTC on the 1st of each month
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
