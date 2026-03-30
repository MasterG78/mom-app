import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkCron() {
  try {
    const jobs = await sql`SELECT jobid, schedule, command, jobname FROM cron.job`;
    console.log("Current Jobs:", JSON.stringify(jobs, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

checkCron();
