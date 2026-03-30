
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function listTables() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('--- TABLES ---');
    tables.forEach(t => console.log(t.table_name));
    console.log('--- END TABLES ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

listTables();
