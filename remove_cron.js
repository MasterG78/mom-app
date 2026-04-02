
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function removeCron() {
  console.log('--- Removing pg_cron Job 1 ---');
  try {
    // Unschedule job by ID
    const result = await sql`SELECT cron.unschedule(1)`;
    console.log(`Unschedule result:`, result);
    
    // Safety check: list remaining jobs
    const jobs = await sql`SELECT jobid, schedule, command FROM cron.job`;
    console.log(`Remaining jobs: ${jobs.length}`);
    jobs.forEach(j => {
      console.log(`- Job ${j.jobid}: [${j.schedule}] -> ${j.command}`);
    });
    
  } catch (error) {
    console.error('Error removing cron job:', error.message);
  } finally {
    await sql.end();
  }
}

removeCron();
