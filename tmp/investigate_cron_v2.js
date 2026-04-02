
import postgres from 'postgres';
import fs from 'fs';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function check() {
  try {
    const jobs = await sql`SELECT * FROM cron.job`;
    const logs = await sql`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50`;
    const funcs = await sql`SELECT routine_name, routine_definition FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'generate_weekly_inventory_snapshot'`;

    const result = { jobs, logs, funcs };
    fs.writeFileSync('tmp/cron_investigation_results.json', JSON.stringify(result, null, 2));
    console.log('Results written to tmp/cron_investigation_results.json');

  } catch (err) {
    console.error('Error during check:', err.message);
  } finally {
    await sql.end();
  }
}

check();
