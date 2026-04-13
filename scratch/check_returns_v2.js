import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const in_stock_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'In Stock'`)[0].id;
        const start_date = '2026-04-06 00:00:00';
        const end_date = '2026-04-12 23:59:59';

        console.log(`Checking items moved TO 'In Stock' between ${start_date} and ${end_date}...`);
        
        // We want changes to 'In Stock' but we want to EXCLUDE initial productions.
        // Initial production is when the item was produced in this same week.
        
        const changes = await sql`
            SELECT 
                sc.inventory_id,
                sc.created_at,
                i.inventory_value,
                i.tag,
                i.produced as produced_date
            FROM status_changes sc
            JOIN inventory i ON sc.inventory_id = i.id
            WHERE sc.status_id = ${in_stock_status_id}
            AND sc.created_at BETWEEN ${start_date} AND ${end_date}
            AND i.produced < ${start_date}
        `;
        
        console.log(`Found ${changes.length} items moved back to 'In Stock' that were produced in previous weeks.`);
        const totalValue = changes.reduce((sum, row) => sum + parseFloat(row.inventory_value || 0), 0);
        console.log(`Total Value of "returned" items: ${totalValue.toFixed(2)}`);
        
        if (changes.length > 0) {
            console.log('Sample of "returned" items:');
            console.table(changes.slice(0, 10));
        }

        // Also check if any items were moved TO 'In Stock' multiple times or if there are other status changes we missed.
        // E.g. what if an item was produced this week, marked sold this week, and then marked in stock this week?
        // It would be in produced_value (expected up)
        // It would be in sold_value (expected down)
        // It would be in actual_closing (reality up)
        // Formula: (Start + Produced - Sold) - Actual
        // (0 + Value - Value) - Value = -Value.
        // Again, a negative discrepancy.
        
        const allInStockThisWeekProducedThisWeek = await sql`
            SELECT 
                sc.inventory_id,
                sc.created_at,
                i.inventory_value,
                i.tag,
                i.produced as produced_date
            FROM status_changes sc
            JOIN inventory i ON sc.inventory_id = i.id
            WHERE sc.status_id = ${in_stock_status_id}
            AND sc.created_at BETWEEN ${start_date} AND ${end_date}
            AND i.produced BETWEEN ${start_date} AND ${end_date}
        `;
        
        console.log(`\nFound ${allInStockThisWeekProducedThisWeek.length} items moved to 'In Stock' that were ALSO produced this week.`);
        // These are items that were produced, maybe changed status, and ended up back in 'In Stock'.
        // If they were marked Sold and then In Stock, they create the same problem.
        
    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
