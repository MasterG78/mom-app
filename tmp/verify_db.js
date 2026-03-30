
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function verify() {
  try {
    console.log('Querying inventory_view via direct Postgres connection...');
    const result = await sql`
      SELECT tag, tagger_name 
      FROM inventory_view 
      ORDER BY produced DESC 
      LIMIT 5
    `;
    
    console.log('Results:');
    console.log(JSON.stringify(result, null, 2));
    
    const hasValues = result.some(r => r.tagger_name !== null);
    if (hasValues) {
      console.log('Verification SUCCESS: tagger_name is populated.');
    } else {
      console.error('Verification FAILURE: tagger_name is still null.');
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await sql.end();
  }
}

verify();
