import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const in_stock_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'In Stock'`)[0].id;
        
        // Look at 100 recent items to get a better sample
        const recentItems = await sql`SELECT id, produced, tag, inventory_value FROM inventory ORDER BY id DESC LIMIT 100`;
        
        console.log(`Checking status_changes for 100 recent items...`);
        let missingCount = 0;
        let missingValue = 0;

        for (const item of recentItems) {
            const changes = await sql`SELECT * FROM status_changes WHERE inventory_id = ${item.id} AND status_id = ${in_stock_status_id}`;
            if (changes.length === 0) {
                missingCount++;
                missingValue += parseFloat(item.inventory_value || 0);
            }
        }
        
        console.log(`Summary: ${missingCount} out of 100 items are missing an 'In Stock' status change entry.`);
        console.log(`Total Value missing from status changes in this sample: ${missingValue.toFixed(2)}`);

        if (missingCount > 0) {
            console.log('\nSample item missing status change:');
            const sampleItem = recentItems.find(item => {
                // Find one that was missing.
                return true; 
            });
            // Let's find exactly one.
        }

    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
