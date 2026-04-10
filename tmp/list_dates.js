
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function check() {
  try {
    const data = await sql`SELECT id, week_ending::text FROM inventory_weekly_snapshots ORDER BY week_ending DESC`;
    data.forEach(d => console.log(`${d.id}: ${d.week_ending}`));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

check();
