
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('--- Checking for Manual Adjustments (Last 7 Days) ---');
    const audits = await sql`
      SELECT 
        action, 
        substring(array_to_string(changed_fields, ',') from 1 for 50) as fields, 
        count(*) 
      FROM inventory_audit 
      WHERE changed_at >= now() - interval '7 days' 
      GROUP BY action, fields
    `;
    console.table(audits);

    console.log('\n--- Checking for Deletions (Last 7 Days) ---');
    const deletes = await sql`
      SELECT count(*) FROM inventory_audit WHERE action = 'DELETE' AND changed_at >= now() - interval '7 days'
    `;
    console.log('Deletions:', deletes[0].count);

  } catch (e) {
    console.error(e.message);
  } finally {
    await sql.end();
  }
}
run();
