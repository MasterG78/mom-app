import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const start_date = '2026-04-06 00:00:00';
        const end_date = '2026-04-12 23:59:59';

        console.log(`Analyzing Stock for week of ${start_date}...`);
        
        const producedThisWeekValue = await sql`
            SELECT SUM(inventory_value) as total 
            FROM inventory 
            WHERE produced BETWEEN ${start_date} AND ${end_date}
        `;
        console.log(`Total Produced Value according to 'produced' column: ${producedThisWeekValue[0].total}`);

        const currentInStockTotal = await sql`
            SELECT SUM(total_value) as total 
            FROM inventory_report_view 
            WHERE current_status = 'In Stock'
        `;
        // Since it's Monday morning, this is close to the snapshot time.
        console.log(`Current In Stock Value (Snapshotted as 425,510.93): ${currentInStockTotal[0].total}`);

        // What if items were produced but the 'produced' date is NULL or something else?
        // Let's check for items created (id sequence or created_at if it exists) this week.
        const createdThisWeekButOldProducedDate = await sql`
            SELECT count(*), SUM(inventory_value) as total
            FROM inventory
            WHERE id > (SELECT MIN(id) FROM inventory WHERE produced >= ${start_date})
            AND produced < ${start_date}
        `;
        console.log(`Items with recent IDs but OLD produced dates: Count: ${createdThisWeekButOldProducedDate[0].count}, Sum: ${createdThisWeekButOldProducedDate[0].total}`);

        // Let's check for the discrepancy value ~151k.
        // Is there any single status change or group that matches?
        
    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
