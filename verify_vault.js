
import postgres from 'postgres';

// Manual configuration from previous research
const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkVault() {
  console.log('--- Checking Supabase Vault Secrets ---');
  try {
    const secrets = await sql`SELECT name, decrypted_secret FROM vault.decrypted_secrets`;
    console.log(`Found ${secrets.length} decrypted secrets in the vault.`);
    
    const required = ['supabase_url', 'service_role_key'];
    const foundNames = secrets.map(s => s.name);
    
    required.forEach(name => {
      const secret = secrets.find(s => s.name === name);
      if (secret) {
        const val = secret.decrypted_secret;
        const masked = val ? (val.substring(0, 10) + '...') : 'NULL';
        console.log(`✅ [${name}]: ${masked}`);
      } else {
        console.log(`❌ [${name}]: MISSING`);
      }
    });

    console.log('\n--- Checking Edge Function Configuration ---');
    // If we have any other checks for the daily email, we can add them here.
    
  } catch (error) {
    console.error('Error querying vault:', error.message);
  } finally {
    await sql.end();
  }
}

checkVault();
