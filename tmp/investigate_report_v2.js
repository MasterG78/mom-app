
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkData() {
  try {
    console.log('--- inventory_weekly_snapshots (All rows) ---');
    const data = await sql`SELECT id, week_ending, created_at, notes FROM inventory_weekly_snapshots ORDER BY week_ending DESC`;
    console.log(JSON.stringify(data, null, 2));

    console.log('--- Cron Jobs ---');
    const jobs = await sql`SELECT * FROM cron.job`;
    console.log(JSON.stringify(jobs, null, 2));

    console.log('--- Recent Job Runs ---');
    const runs = await sql`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20`;
    console.log(JSON.stringify(runs, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkData();
