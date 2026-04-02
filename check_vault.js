
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.SUPABASE_CONNECTION_STRING;

if (!connectionString) {
  console.error('Missing SUPABASE_CONNECTION_STRING');
  process.exit(1);
}

const sql = postgres(connectionString);

async function checkVault() {
  console.log('Checking decrypted_secrets in vault schema...');
  try {
    const secrets = await sql`SELECT name, decrypted_secret FROM vault.decrypted_secrets`;
    console.log(`Found ${secrets.length} decrypted secrets:`);
    secrets.forEach(s => {
      console.log(`- ${s.name}: ${s.decrypted_secret ? 'CORRECT' : 'MISSING'}`);
    });
  } catch (error) {
    console.error('Error querying vault schema:', error.message);
    if (error.message.includes('permission denied')) {
        console.log('Permission denied. Try querying it from the project dashboard or ensure you have the correct user.');
    }
  } finally {
    await sql.end();
  }
}

checkVault();
