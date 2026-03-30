-- Daily Production Report Email Schedule
-- Runs at 01:00 UTC daily = 20:00 ET (fixed UTC-5, ignoring DST per user request)

-- Enable required extensions (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- NOTE: This cron job requires two secrets to be present in the Supabase Vault:
-- 1. 'supabase_url' (e.g., 'https://xyz.supabase.co')
-- 2. 'service_role_key' (your project's service_role key)
-- 
-- If the email stops working, ensure these secrets are correctly set in the 
-- vault.decrypted_secrets table. Run the FOLLOWING SQL manually if missing:
/*
INSERT INTO vault.secrets (name, secret) 
VALUES 
  ('supabase_url', 'YOUR_PROJECT_URL'),
  ('service_role_key', 'YOUR_SERVICE_ROLE_KEY')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
*/

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
