const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
// Load both .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Querying owner_weekly_trend_report...');
    const { data: reportData, error: reportError } = await supabase
        .from('owner_weekly_trend_report')
        .select('*')
        .order('week_ending', { ascending: false })
        .limit(10);

    if (reportError) {
        console.error('Report Error:', reportError);
    } else {
        console.log('Weekly Trend Report:');
        console.table(reportData);
    }

    console.log('\nQuerying inventory_weekly_snapshots raw data...');
    const { data: snapshotData, error: snapshotError } = await supabase
        .from('inventory_weekly_snapshots')
        .select('*')
        .order('week_ending', { ascending: false })
        .limit(10);

    if (snapshotError) {
        console.error('Snapshot Error:', snapshotError);
    } else {
        console.log('Inventory Weekly Snapshots (Raw):');
        console.table(snapshotData);
    }
}

run();
