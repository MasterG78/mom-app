
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

const secrets = [
  { name: 'supabase_url', value: 'https://boyleodbpsgqtjbstcua.supabase.co' },
  { name: 'service_role_key', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveWxlb2RicHNncXRqYnN0Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgxNzg4NywiZXhwIjoyMDYwMzkzODg3fQ.HUTqlzogDUiaFV-2Way2t_2QaRzyuPgynWfjG_j5uqw' }
];

async function fixVault() {
  console.log('--- Populating Supabase Vault Secrets ---');
  try {
    for (const secret of secrets) {
      console.log(`Setting secret [${secret.name}]...`);
      // Use vault.create_secret(secret, name, description)
      try {
          await sql`SELECT vault.create_secret(${secret.value}, ${secret.name}, 'Added by AI Assistant for Daily Production Email')`;
          console.log(`✅ Successfully created ${secret.name}`);
      } catch (e) {
          if (e.message.includes('already exists') || e.message.includes('unique constraint')) {
              console.log(`Secret ${secret.name} already exists, updating...`);
              // vault.update_secret doesn't always exist or has different signature.
              // Let's try to delete and recreate if updating is complex.
              await sql`DELETE FROM vault.secrets WHERE name = ${secret.name}`;
              await sql`SELECT vault.create_secret(${secret.value}, ${secret.name}, 'Updated by AI Assistant for Daily Production Email')`;
              console.log(`✅ Successfully updated ${secret.name}`);
          } else {
              throw e;
          }
      }
    }
    
    // Final verification
    const count = await sql`SELECT count(*) FROM vault.secrets`;
    console.log(`Vault now contains ${count[0].count} secrets.`);
    
  } catch (error) {
    console.error('Error fixing vault:', error.message);
  } finally {
    await sql.end();
  }
}

fixVault();
