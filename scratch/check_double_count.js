import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const start_of_week = '2026-04-06 00:00:00';
        const snapshot_time = '2026-04-07 01:20:30'; // Time row 10 was created

        console.log(`Checking activity between ${start_of_week} and ${snapshot_time}...`);
        
        const sold_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'Sold'`)[0].id;
        const issued_status_id = (await sql`SELECT id FROM statuses WHERE status_name = 'Issued'`)[0].id;
        const void_status_ids = (await sql`SELECT id FROM statuses WHERE status_name IN ('Void', 'Missing')`).map(r => r.id);

        const sold = await sql`SELECT SUM(i.inventory_value) FROM inventory i JOIN status_changes sc ON i.id = sc.inventory_id WHERE sc.status_id = ${sold_status_id} AND sc.created_at BETWEEN ${start_of_week} AND ${snapshot_time}`;
        const produced = await sql`SELECT SUM(inventory_value) FROM inventory WHERE produced BETWEEN ${start_of_week} AND ${snapshot_time}`;
        const issued = await sql`SELECT SUM(i.inventory_value) FROM inventory i JOIN status_changes sc ON i.id = sc.inventory_id WHERE sc.status_id = ${issued_status_id} AND sc.created_at BETWEEN ${start_of_week} AND ${snapshot_time}`;
        const voided = await sql`SELECT SUM(i.inventory_value) FROM inventory i JOIN status_changes sc ON i.id = sc.inventory_id WHERE sc.status_id IN (${void_status_ids[0]}, ${void_status_ids[1]}) AND sc.created_at BETWEEN ${start_of_week} AND ${snapshot_time}`;

        console.log(`Sold: ${sold[0].sum}`);
        console.log(`Produced: ${produced[0].sum}`);
        console.log(`Issued: ${issued[0].sum}`);
        console.log(`Voided: ${voided[0].sum}`);

        const netChange = parseFloat(produced[0].sum || 0) - parseFloat(sold[0].sum || 0) - parseFloat(issued[0].sum || 0) - parseFloat(voided[0].sum || 0);
        console.log(`Net Change: ${netChange.toFixed(2)}`);

    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
