import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const start_date = '2026-04-06 00:00:00';
        const end_date = '2026-04-12 23:59:59';

        console.log(`Deep Audit for week ${start_date} to ${end_date}`);

        // 1. Get Opening Balance (Our reconstruction)
        // We already have this as 551,051.68
        
        // 2. Get Closing Balance (Our reconstruction)
        // We already have this as 425,510.93
        
        // 3. Let's look at the ACTUAL status changes that occurred
        const statusCounts = await sql`
            SELECT s.status_name, COUNT(*), SUM(i.inventory_value) as total_value
            FROM status_changes sc
            JOIN statuses s ON sc.status_id = s.id
            JOIN inventory i ON sc.inventory_id = i.id
            WHERE sc.created_at BETWEEN ${start_date} AND ${end_date}
            GROUP BY s.status_name
        `;
        console.log('\nStatus Change Summary (Movements TO status during the week):');
        console.table(statusCounts);

        // 4. Let's look at Deletions
        const deletions = await sql`
            SELECT COUNT(*), SUM((old_data->>'inventory_value')::numeric) as total_value
            FROM inventory_audit
            WHERE action = 'DELETE' AND changed_at BETWEEN ${start_date} AND ${end_date}
        `;
        console.log('\nDeletions Summary:');
        console.table(deletions);

        // 5. Let's look at Updates
        const updates = await sql`
            SELECT COUNT(*), SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric) as total_change
            FROM inventory_audit
            WHERE action = 'UPDATE' AND changed_at BETWEEN ${start_date} AND ${end_date}
            AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields))
        `;
        console.log('\nValue Updates Summary:');
        console.table(updates);

    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
