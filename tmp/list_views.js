
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function listViews() {
  try {
    const views = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
    `;
    console.log('--- VIEWS ---');
    views.forEach(v => console.log(v.table_name));
    console.log('--- END VIEWS ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

listViews();
