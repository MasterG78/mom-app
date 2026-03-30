
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function listSchemas() {
  try {
    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata
    `;
    console.log('Schemas: ' + schemas.map(s => s.schema_name).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

listSchemas();
