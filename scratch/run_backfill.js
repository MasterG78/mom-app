import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        console.log('Starting historical backfill for weekly snapshots...');
        
        // Target Sundays
        const targetSundays = [
            '2026-03-22',
            '2026-03-29',
            '2026-04-05',
            '2026-04-12'
        ];

        for (const sunday of targetSundays) {
            // week_ending = sunday.
            // run_date should be the following Monday (sunday + 1 day) 
            // because the function snaps to the PREVIOUS Sunday.
            
            const runDate = new Date(sunday);
            runDate.setDate(runDate.getDate() + 1);
            const runDateStr = runDate.toISOString().split('T')[0];
            
            console.log(`Recalculating week ending ${sunday} (running as if it were ${runDateStr})...`);
            await sql`SELECT generate_weekly_inventory_snapshot(${runDateStr})`;
        }

        console.log('Backfill complete. Querying latest results...');
        
        const reportData = await sql`
            SELECT 
                week_ending, 
                "Opening Inv", 
                "Closing Inv", 
                "Expected Change", 
                "Shrinkage/Discrepancy"
            FROM public.owner_weekly_trend_report 
            ORDER BY week_ending DESC 
            LIMIT 5
        `;
        console.table(reportData);

    } catch (err) {
        console.error('Error during backfill:', err);
    } finally {
        await sql.end();
    }
}
run();
