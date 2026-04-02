
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('1. Finding a bundle to edit...');
    const result_bundle = await sql`SELECT id, tag, boardfeet, inventory_value FROM inventory LIMIT 1`;
    if (result_bundle.length === 0) { console.log('No inventory found.'); return; }
    
    const bundle = result_bundle[0];
    const id = bundle.id;
    const oldVal = parseFloat(bundle.inventory_value);
    const newVal = oldVal + 100.00;

    console.log(`2. Manually updating value for tag ${bundle.tag} ($${oldVal} -> $${newVal})...`);
    
    const user_id = '71c80b7d-61ac-47cf-9998-f482553fc54a';
    await sql.unsafe(`SET request.jwt.claims = '{"sub": "${user_id}"}'`);
    
    await sql`UPDATE inventory SET inventory_value = ${newVal} WHERE id = ${id}`;

    console.log('3. Running snapshot to capture the adjustment...');
    await sql`SELECT generate_weekly_inventory_snapshot()`;

    console.log('4. Verifying snapshot audit columns...');
    const result_snap = await sql`SELECT week_ending, manual_adjustment_value, manual_deletion_value FROM inventory_weekly_snapshots ORDER BY week_ending DESC LIMIT 1`;
    console.log('Audit Results:', JSON.stringify(result_snap, null, 2));

    // Cleanup
    console.log('5. Reverting manual change...');
    await sql`UPDATE inventory SET inventory_value = ${oldVal} WHERE id = ${id}`;

  } catch (e) {
    console.error('❌ Error during verification:', e.message);
  } finally {
    await sql.end();
  }
}
run();
