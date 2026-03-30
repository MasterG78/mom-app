
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function listForeignTables() {
  try {
    const ftables = await sql`
      SELECT foreign_table_name 
      FROM information_schema.foreign_tables 
      WHERE foreign_table_schema = 'public'
    `;
    console.log('Foreign Tables: ' + ftables.map(ft => ft.foreign_table_name).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

listForeignTables();
