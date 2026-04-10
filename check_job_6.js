
import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkJob6() {
  console.log('--- Job 6 (Monday In-Stock) Run History ---');
  try {
    const runs = await sql`
      SELECT 
        runid, 
        status, 
        start_time AT TIME ZONE 'UTC' as start_time_utc,
        return_message
      FROM cron.job_run_details 
      WHERE jobid = 6
      ORDER BY start_time DESC 
      LIMIT 10
    `;
    runs.forEach(r => {
      console.log(`- Run ${r.runid}: ${r.status} at ${r.start_time_utc} UTC`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
checkJob6();
