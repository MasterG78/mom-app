
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
  console.log('Verifying inventory_view for tagger_name...');
  const { data, error } = await supabase
    .from('inventory_view')
    .select('tag, tagger_name')
    .order('produced', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching inventory_view:', error);
  } else {
    console.log('Results from inventory_view (tagger_name should not be null):');
    console.log(JSON.stringify(data, null, 2));
    
    const allNull = data.every(item => item.tagger_name === null);
    if (allNull) {
      console.error('Verification FAILED: All tagger_name values are still null.');
    } else {
      console.log('Verification PASSED: tagger_name values found.');
    }
  }
}

verifyFix();
