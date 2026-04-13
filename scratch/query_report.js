import postgres from 'postgres';

const sql = postgres("postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres");

async function run() {
    try {
        console.log('Querying owner_weekly_trend_report...');
        const reportData = await sql`
            SELECT 
                week_ending, 
                "Weekly Revenue", 
                "Gross Profit", 
                "Opening Inv", 
                "Closing Inv", 
                "Inv Growth %", 
                "Expected Change", 
                "Shrinkage/Discrepancy",
                "Manual Adjustments",
                "Deletions"
            FROM public.owner_weekly_trend_report 
            ORDER BY week_ending DESC 
            LIMIT 10
        `;
        console.table(reportData);

        console.log('\nQuerying inventory_weekly_snapshots raw data...');
        const snapshotData = await sql`
            SELECT * FROM public.inventory_weekly_snapshots 
            ORDER BY week_ending DESC 
            LIMIT 10
        `;
        console.table(snapshotData);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

run();
