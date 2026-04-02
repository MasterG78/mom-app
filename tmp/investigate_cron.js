
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function check() {
  try {
    console.log('--- Snapshot Function Source ---');
    const funcSource = await sql`SELECT pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'generate_weekly_inventory_snapshot'`;
    if (funcSource.length > 0) { console.log(funcSource[0].def); }

    console.log('\n--- Cron Job details ---');
    const jobs = await sql`SELECT * FROM cron.job`;
    console.log(JSON.stringify(jobs, null, 2));

    console.log('\n--- Cron Run Logs ---');
    const logs = await sql`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10`;
    console.log(JSON.stringify(logs, null, 2));

  } catch (err) {
    console.error('Error during check:', err.message);
  } finally {
    await sql.end();
  }
}

check();
