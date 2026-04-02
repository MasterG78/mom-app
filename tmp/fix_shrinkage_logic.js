
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

const function_sql = `
CREATE OR REPLACE FUNCTION public.generate_weekly_inventory_snapshot()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    prev_closing numeric;
    start_date timestamptz;
    end_date timestamptz;
    week_end_date date;
    sold_status_id int;
    issued_status_id int;
    void_status_ids int[];
BEGIN
    -- 1. Setup Timeframe
    -- Always snap to the previous Sunday regardless of when run mid-week
    week_end_date := CURRENT_DATE;
    start_date := date_trunc('week', CURRENT_DATE - interval '7 days');
    end_date := date_trunc('week', CURRENT_DATE) - interval '1 second';
    
    -- 2. Lookup Status IDs
    SELECT id INTO sold_status_id FROM statuses WHERE status_name = 'Sold' LIMIT 1;
    SELECT id INTO issued_status_id FROM statuses WHERE status_name = 'Issued' LIMIT 1;
    SELECT ARRAY_AGG(id) INTO void_status_ids FROM statuses WHERE status_name IN ('Void', 'Missing');

    -- 3. Carry forward the Balance
    SELECT actual_closing_value INTO prev_closing
    FROM inventory_weekly_snapshots
    WHERE week_ending < week_end_date
    ORDER BY week_ending DESC LIMIT 1;

    IF prev_closing IS NULL THEN prev_closing := 0; END IF;

    -- 4. Execute the Snapshot
    INSERT INTO inventory_weekly_snapshots (
        week_ending,
        starting_value,
        sales_value,
        cogs_value,
        sold_value,
        produced_value,
        issued_value,
        void_value,
        actual_closing_value,
        notes
    )
    SELECT 
        week_end_date,
        prev_closing,
        -- Revenue from View (Sum of sales recorded in this period)
        COALESCE((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date), 0),
        -- COGS / Sold Value from Table (Value of items marked 'Sold' in this period)
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = sold_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Sold Value from Table (Same as COGS)
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = sold_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Produced Value from Table (Value of items produced this week)
        COALESCE((SELECT SUM(inventory_value) FROM inventory WHERE produced BETWEEN start_date AND end_date), 0),
        -- Issued Value (Aliased i.inventory_value)
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = issued_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Void Value (Aliased i.inventory_value)
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = ANY(void_status_ids) AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Actual In Stock Value (Current Snapshot)
        COALESCE((SELECT SUM(total_value) FROM inventory_report_view WHERE current_status = 'In Stock'), 0),
        'Automated Snapshot (Corrected Logic)'
    ON CONFLICT (week_ending) DO UPDATE SET
        starting_value = EXCLUDED.starting_value,
        sales_value = EXCLUDED.sales_value,
        cogs_value = EXCLUDED.cogs_value,
        sold_value = EXCLUDED.sold_value,
        produced_value = EXCLUDED.produced_value,
        issued_value = EXCLUDED.issued_value,
        void_value = EXCLUDED.void_value,
        actual_closing_value = EXCLUDED.actual_closing_value,
        notes = 'Updated ' || now() || ' with corrected logic';
END;
$function$;
`;

async function apply() {
  try {
    console.log('--- Applying Fix for Shrinkage Logic ---');
    await sql.unsafe(function_sql);
    console.log('   ✅ Function updated successfully.');
    
    console.log('--- Re-running Snapshot for data correction ---');
    await sql`SELECT generate_weekly_inventory_snapshot()`;
    console.log('   ✅ Snapshot re-generated.');
    
    console.log('--- Final Check ---');
    const logs = await sql`SELECT week_ending, sold_value, produced_value, notes FROM inventory_weekly_snapshots ORDER BY week_ending DESC LIMIT 1`;
    console.log(JSON.stringify(logs, null, 2));

  } catch (err) {
    console.error('❌ Error applying fix:', err.message);
  } finally {
    await sql.end();
  }
}

apply();
