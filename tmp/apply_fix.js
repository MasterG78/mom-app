
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('--- Applying Database Fix ---');

    console.log('1. Adding sold_value column to inventory_weekly_snapshots...');
    await sql`ALTER TABLE inventory_weekly_snapshots ADD COLUMN IF NOT EXISTS sold_value numeric DEFAULT 0`;
    console.log('   ✅ Column added.');

    console.log('2. Manually running the weekly snapshot function...');
    // The function determines the week ending based on current date (today is Thursday 04-02)
    // It should have run on Sunday 03-29. Let's make sure it handles the missing week.
    // The current function uses CURRENT_DATE.
    await sql`SELECT generate_weekly_inventory_snapshot()`;
    console.log('   ✅ Snapshot function executed.');

    console.log('3. Verifying the snapshot row exists...');
    const result = await sql`SELECT week_ending, sold_value, actual_closing_value FROM inventory_weekly_snapshots ORDER BY week_ending DESC LIMIT 1`;
    console.log('Latest Snapshot:', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('❌ Error during execution:', err.message);
  } finally {
    await sql.end();
  }
}

run();
