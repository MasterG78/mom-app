
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkView() {
  console.log('Checking inventory_view...');
  const { data, error } = await supabase
    .from('inventory_view')
    .select('*')
    .order('produced', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching inventory_view:', error);
  } else {
    console.log('Data from inventory_view:', JSON.stringify(data, null, 2));
  }

  console.log('Checking inventory table (tagger column)...');
  const { data: invData, error: invError } = await supabase
    .from('inventory')
    .select('id, tag, tagger')
    .order('produced', { ascending: false })
    .limit(5);

  if (invError) {
    console.error('Error fetching inventory:', invError);
  } else {
    console.log('Data from inventory table (tagger):', JSON.stringify(invData, null, 2));
  }
}

checkView();
