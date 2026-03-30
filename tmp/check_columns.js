
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkColumns() {
  try {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory'
    `;
    console.log('Inventory Columns: ' + columns.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

checkColumns();
