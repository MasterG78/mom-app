
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function check() {
  try {
    const snapshots = await sql`SELECT week_ending, sales_value, produced_value, actual_closing_value FROM inventory_weekly_snapshots ORDER BY week_ending DESC LIMIT 10`;
    const jobs = await sql`SELECT jobid, schedule, command, active FROM cron.job`;
    const view = await sql`SELECT view_definition FROM information_schema.views WHERE table_name = 'owner_weekly_trend_report'`;
    const funcs = await sql`SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name ILIKE '%snapshot%'`;

    console.log('RESULTS_START');
    console.log(JSON.stringify({ snapshots, jobs, view, funcs }, null, 2));
    console.log('RESULTS_END');

  } catch (err) {
    console.error('ERROR_START');
    console.error(err.message);
  } finally {
    await sql.end();
  }
}

check();
