
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function listMaterializedViews() {
  try {
    const mviews = await sql`
      SELECT matviewname 
      FROM pg_catalog.pg_matviews 
      WHERE schemaname = 'public'
    `;
    console.log('Materialized Views: ' + mviews.map(mv => mv.matviewname).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

listMaterializedViews();
