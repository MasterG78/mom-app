import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function run() {
    try {
        const target_time = '2026-04-12 23:59:59';
        const start_time = '2026-04-06 00:00:00';

        console.log(`Tag-Level Audit for week ending ${target_time}...`);

        const in_stock_status_all = (await sql`SELECT id FROM statuses WHERE status_name = 'In Stock'`)[0].id;
        const out_status_ids = (await sql`SELECT id FROM statuses WHERE status_name IN ('Sold', 'Issued', 'Void', 'Missing')`).map(s => s.id);

        // 1. Get ALL tags that were 'In Stock' at Start OR became 'In Stock' during the week
        const tags = await sql`
            SELECT DISTINCT i.id, i.tag, i.inventory_value, i.produced
            FROM inventory i
            LEFT JOIN status_changes sc ON i.id = sc.inventory_id
            WHERE i.produced <= ${target_time}
            OR (sc.created_at <= ${target_time})
        `;

        console.log(`Analyzing ${tags.length} tags...`);
        let total_discrepancy = 0;
        let count = 0;

        for (const tag of tags) {
            // State at Start
            const start_state = await sql`
                SELECT status_id FROM status_changes 
                WHERE inventory_id = ${tag.id} AND created_at <= ${start_time} 
                ORDER BY created_at DESC LIMIT 1
            `;
            const was_in_stock_start = (tag.produced <= start_time) && (start_state.length === 0 || start_state[0].status_id === in_stock_status_all);
            
            // State at End
            const end_state = await sql`
                SELECT status_id FROM status_changes 
                WHERE inventory_id = ${tag.id} AND created_at <= ${target_time} 
                ORDER BY created_at DESC LIMIT 1
            `;
            const was_in_stock_end = (tag.produced <= target_time) && (end_state.length === 0 || end_state[0].status_id === in_stock_status_all);

            // Movements
            const produced_this_week = (tag.produced > start_time && tag.produced <= target_time) ? parseFloat(tag.inventory_value) : 0;
            const removed_this_week = (await sql`
                SELECT SUM(${tag.inventory_value}) as val FROM status_changes 
                WHERE inventory_id = ${tag.id} AND status_id = ANY(${out_status_ids}) 
                AND created_at BETWEEN ${start_time} AND ${target_time}
            `)[0].val || 0;
            const returned_this_week = (await sql`
                SELECT SUM(${tag.inventory_value}) as val FROM status_changes 
                WHERE inventory_id = ${tag.id} AND status_id = ${in_stock_status_all} 
                AND created_at BETWEEN ${start_time} AND ${target_time}
                AND produced < ${start_time}
            `)[0].val || 0;

            const expected_end = (was_in_stock_start ? parseFloat(tag.inventory_value) : 0) + produced_this_week + parseFloat(returned_this_week) - parseFloat(removed_this_week);
            const actual_end = was_in_stock_end ? parseFloat(tag.inventory_value) : 0;

            const discrepancy = expected_end - actual_end;
            if (Math.abs(discrepancy) > 0.01) {
                if (count < 10) {
                    console.log(`Tag ${tag.tag} (ID ${tag.id}): Start=${was_in_stock_start}, End=${was_in_stock_end}, Prod=${produced_this_week}, Rem=${removed_this_week}, Ret=${returned_this_week}, Exp=${expected_end}, Act=${actual_end}, Disc=${discrepancy}`);
                }
                total_discrepancy += discrepancy;
                count++;
            }
        }

        console.log(`\nTotal Tags with Discrepancy: ${count}`);
        console.log(`Total Sum of Discrepancies: ${total_discrepancy.toFixed(2)}`);

    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
