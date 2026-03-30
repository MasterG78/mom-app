import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function fixSchedule() {
  try {
    const url = 'https://boyleodbpsgqtjbstcua.supabase.co/functions/v1/generate-production-report';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveWxlb2RicHNncXRqYnN0Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgxNzg4NywiZXhwIjoyMDYwMzkzODg3fQ.HUTqlzogDUiaFV-2Way2t_2QaRzyuPgynWfjG_j5uqw';

    const command = `
      SELECT net.http_post(
        url := '${url}',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || '${key}',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    `;

    console.log("1. Unscheduling existing job...");
    try {
      await sql`SELECT cron.unschedule('daily-production-report')`;
    } catch(e) { /* ignore */ }

    console.log("2. Scheduling for Sun-Thu 8:00 PM ET (01:00 UTC Mon-Fri)...");
    await sql.unsafe(`
      SELECT cron.schedule(
        'daily-production-report',
        '0 1 * * 1,2,3,4,5',
        '${command.replace(/'/g, "''")}'
      );
    `);

    console.log("3. Verification...");
    const jobs = await sql`SELECT jobid, schedule, jobname FROM cron.job WHERE jobname = 'daily-production-report'`;
    console.log("Verified Current Jobs:", JSON.stringify(jobs, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Failed to fix schedule:", err.message);
    process.exit(1);
  }
}

fixSchedule();
