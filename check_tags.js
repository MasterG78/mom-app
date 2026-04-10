
import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkTags() {
  console.log('--- Checking Tags 396-399 ---');
  try {
    const tags = await sql`
      SELECT tag, produced, current_status 
      FROM inventory_report_view 
      WHERE tag::text IN ('396', '397', '398', '399')
    `;
    tags.forEach(t => {
      console.log(`Tag ${t.tag}: produced ${t.produced}, status ${t.current_status}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
checkTags();
