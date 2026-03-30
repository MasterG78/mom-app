import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function restoreVault() {
  try {
    console.log("1. Enabling extensions...");
    await sql`CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions`;
    await sql`CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions`;

    console.log("2. Clearing old jobs (using unschedule to avoid permission issues)...");
    // We try to unschedule. If it doesn't exist, it might throw, so we wrap in try-catch or use a manual check.
    try {
      await sql`SELECT cron.unschedule('daily-production-report')`;
    } catch (e) {
      console.log("No existing job to unschedule or error:", e.message);
    }

    console.log("3. Restoring vault secrets...");
    const url = 'https://boyleodbpsgqtjbstcua.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveWxlb2RicHNncXRqYnN0Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgxNzg4NywiZXhwIjoyMDYwMzkzODg3fQ.HUTqlzogDUiaFV-2Way2t_2QaRzyuPgynWfjG_j5uqw';

    // Vault secrets often have RLS too, but usually the postgres user can insert.
    await sql`
      INSERT INTO vault.secrets (name, secret) 
      VALUES 
        ('supabase_url', ${url}),
        ('service_role_key', ${key})
      ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
    `;

    console.log("4. Re-scheduling the job...");
    await sql`
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
    `;

    console.log("Vault restored and job scheduled!");
    process.exit(0);
  } catch (err) {
    console.error("Restoration failed:", err.message);
    process.exit(1);
  }
}

restoreVault();
