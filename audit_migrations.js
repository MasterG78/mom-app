
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function auditMigrations() {
  console.log('--- Auditing Applied Migrations on Live DB ---');
  try {
    const applied = await sql`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC`;
    console.log(`Found ${applied.length} applied migrations on production:`);
    applied.forEach(m => console.log(`- ${m.version}`));
  } catch (error) {
    if (error.message.includes('relation "supabase_migrations.schema_migrations" does not exist')) {
        console.log('The "supabase_migrations.schema_migrations" table does not exist. This production instance might have been set up manually or uses an older migration system.');
    } else {
        console.error('Error auditing migrations:', error.message);
    }
  } finally {
    await sql.end();
  }
}

auditMigrations();
