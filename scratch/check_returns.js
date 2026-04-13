import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const sold_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'Sold'`)[0].id;
        const in_stock_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'In Stock'`)[0].id;

        const start_date = '2026-04-06 00:00:00';
        const end_date = '2026-04-12 23:59:59';

        console.log(`Checking returns (Sold -> In Stock) between ${start_date} and ${end_date}...`);
        
        // Find status changes to 'In Stock' where the PREVIOUS status was 'Sold', 'Issued', or 'Void'
        // This is tricky because we don't have the previous status in the status_changes table directly (usually we look at the one before it by created_at)
        
        // Alternatively, look for ANY status change TO 'In Stock' for items that were produced BEFORE the start date
        // or just look at all status changes TO 'In Stock' this week.
        
        const inStockChanges = await sql`
            SELECT 
                sc.inventory_id,
                sc.created_at,
                i.inventory_value,
                i.tag_number
            FROM status_changes sc
            JOIN inventory i ON sc.inventory_id = i.id
            WHERE sc.status_id = ${in_stock_status_id}
            AND sc.created_at BETWEEN ${start_date} AND ${end_date}
            ORDER BY sc.created_at ASC
        `;
        
        console.log(`Found ${inStockChanges.length} changes to 'In Stock' this week.`);
        const totalValue = inStockChanges.reduce((sum, row) => sum + parseFloat(row.inventory_value || 0), 0);
        console.log(`Total Value of items moved TO 'In Stock': ${totalValue.toFixed(2)}`);
        
        if (inStockChanges.length > 0) {
            console.log('Sample of changes:');
            console.table(inStockChanges.slice(0, 10));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
