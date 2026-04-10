
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkData() {
  try {
    console.log('--- inventory_weekly_snapshots LAST 5 ---');
    const data = await sql`SELECT id, week_ending, created_at, left(notes, 50) as notes_short FROM inventory_weekly_snapshots ORDER BY week_ending DESC LIMIT 5`;
    data.forEach(d => console.log(`${d.week_ending.toISOString()} (Created: ${d.created_at.toISOString()}) - ${d.notes_short}`));

    console.log('--- Cron Job 1 Run Details LAST 5 ---');
    const runs = await sql`SELECT runid, jobid, start_time, end_time, status, return_message FROM cron.job_run_details WHERE jobid = 1 ORDER BY start_time DESC LIMIT 5`;
    runs.forEach(r => console.log(`Run ${r.runid}: ${r.start_time.toISOString()} - ${r.status} (${r.return_message})`));

    console.log('--- Cron Job 1 Definition ---');
    const job = await sql`SELECT * FROM cron.job WHERE jobid = 1`;
    console.log(JSON.stringify(job, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkData();
