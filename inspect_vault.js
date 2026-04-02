
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkSchema() {
  console.log('--- Checking Vault Table Schema ---');
  try {
    const columns = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'vault' AND table_name = 'secrets'`;
    console.log(`Table vault.secrets columns:`);
    columns.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));
    
    console.log('\n--- Checking Vault Routines ---');
    const routines = await sql`SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'vault'`;
    routines.forEach(r => console.log(`- ${r.routine_name}`));

  } catch (error) {
    console.error('Error checking schema:', error.message);
  } finally {
    await sql.end();
  }
}

checkSchema();
