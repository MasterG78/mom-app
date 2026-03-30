
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkColumns() {
  try {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory'
      ORDER BY column_name
    `;
    console.log('--- INVENTORY COLUMNS ---');
    columns.forEach(c => console.log(c.column_name));
    console.log('--- END ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

checkColumns();
