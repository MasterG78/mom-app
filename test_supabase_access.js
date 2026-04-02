
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAccess() {
  console.log('Testing access to vault.decrypted_secrets...');
  const { data, error } = await supabase
    .from('decrypted_secrets')
    .select('*')
    .limit(1);

  if (error) {
    if (error.code === '42P01') {
       console.log('Schema "vault" not found or decrypted_secrets is restricted. This is normal if vault is not enabled or structured differently.');
       console.log('Error details:', error);
    } else {
       console.error('API Error:', error);
    }
  } else {
    console.log('Successfully accessed vault! Found secrets:', data.length);
  }

  console.log('\nTesting direct SQL via RPC or similar (if available)...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_service_role_status');
  if (rpcError) {
    console.log('RPC check failed (expected if get_service_role_status does not exist).');
  } else {
    console.log('RPC check passed! Data:', rpcData);
  }
}

testAccess();
