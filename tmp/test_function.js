
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function check() {
  try {
    const dates = await sql`
      SELECT 
        CURRENT_DATE as today,
        date_trunc('week', CURRENT_DATE - interval '7 days') as start_date,
        date_trunc('week', CURRENT_DATE) - interval '1 second' as end_date
    `;
    console.log('Function Logic for TODAY:', JSON.stringify(dates[0], null, 2));

    const sundayDates = await sql`
      SELECT 
        '2026-04-05'::date as target_date,
        date_trunc('week', '2026-04-05'::date - interval '7 days') as start_date,
        date_trunc('week', '2026-04-05'::date) - interval '1 second' as end_date
    `;
    console.log('Function Logic for LAST SUNDAY:', JSON.stringify(sundayDates[0], null, 2));

    console.log('--- Testing function execution ---');
    await sql`SELECT generate_weekly_inventory_snapshot()`;
    console.log('Function executed successfully.');

    const lastRows = await sql`SELECT week_ending, created_at, left(notes, 30) as notes FROM inventory_weekly_snapshots ORDER BY week_ending DESC LIMIT 2`;
    console.log('--- Post-run snaprows ---');
    console.log(JSON.stringify(lastRows, null, 2));

  } catch (error) {
    console.error('Error during manually run:', error);
  } finally {
    await sql.end();
  }
}

check();
