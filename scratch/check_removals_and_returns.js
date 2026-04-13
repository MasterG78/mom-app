import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const sold_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'Sold'`)[0].id;
        const issued_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'Issued'`)[0].id;
        const void_status_ids = (await sql`SELECT id FROM statuses WHERE status_name IN ('Void', 'Missing')`).map(r => r.id);
        const in_stock_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'In Stock'`)[0].id;

        const start_date = '2026-04-06 00:00:00';
        const end_date = '2026-04-12 23:59:59';

        console.log(`Checking for items that were removed and then returned this week...`);
        
        const doubleChanges = await sql`
            WITH removals AS (
                SELECT 
                    inventory_id,
                    status_id,
                    created_at,
                    MIN(created_at) OVER(PARTITION BY inventory_id) as first_removal
                FROM status_changes
                WHERE status_id IN (${sold_status_id}, ${issued_status_id}, ${void_status_ids[0]}, ${void_status_ids[1]})
                AND created_at BETWEEN ${start_date} AND ${end_date}
            ),
            returns AS (
                SELECT 
                    inventory_id,
                    created_at
                FROM status_changes
                WHERE status_id = ${in_stock_status_id}
                AND created_at BETWEEN ${start_date} AND ${end_date}
            )
            SELECT 
                r.inventory_id,
                i.tag,
                i.inventory_value,
                rem.status_id as removal_status_id,
                rem.created_at as removal_date,
                ret.created_at as return_date
            FROM returns ret
            JOIN removals rem ON ret.inventory_id = rem.inventory_id AND ret.created_at > rem.created_at
            JOIN inventory i ON ret.inventory_id = i.id
            ORDER BY ret.created_at ASC
        `;
        
        console.log(`Found ${doubleChanges.length} return events after removals this week.`);
        const totalValue = doubleChanges.reduce((sum, row) => sum + parseFloat(row.inventory_value || 0), 0);
        console.log(`Total Value: ${totalValue.toFixed(2)}`);

        if (doubleChanges.length > 0) {
            console.log('Sample:');
            console.table(doubleChanges.slice(0, 5));
        }

        // Now check for the BIG one: Are we missing any production entries?
        // Or is there a disconnect between 'produced' date and the status change record?
        
        console.log('\nChecking total value of items currently In Stock that were NOT counted as produced this week OR starting from last week.');
        // This is tricky.
        
    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
