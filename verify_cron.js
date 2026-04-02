
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkCron() {
  console.log('--- Checking Supabase Cron Jobs ---');
  try {
    const jobs = await sql`SELECT jobid, schedule, command, active FROM cron.job`;
    console.log(`Found ${jobs.length} jobs in cron.job:`);
    jobs.forEach(j => {
      console.log(`- Job ${j.jobid}: [${j.schedule}] -> ${j.command} (Active: ${j.active})`);
    });
  } catch (error) {
    if (error.message.includes('permission denied')) {
        console.log('Permission denied to cron.job. This is normal if you are not an owner of the schema.');
    } else {
        console.error('Error querying cron:', error.message);
    }
  } finally {
    await sql.end();
  }
}

checkCron();
