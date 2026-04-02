
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('--- Updating Database Schema for Audit Tracking ---');

    console.log('1. Adding manual_adjustment_value column...');
    await sql`ALTER TABLE inventory_weekly_snapshots ADD COLUMN IF NOT EXISTS manual_adjustment_value numeric DEFAULT 0`;
    
    console.log('2. Adding manual_deletion_value column...');
    await sql`ALTER TABLE inventory_weekly_snapshots ADD COLUMN IF NOT EXISTS manual_deletion_value numeric DEFAULT 0`;

    console.log('   ✅ Schema updated.');

    console.log('3. Updating generate_weekly_inventory_snapshot() logic...');
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
        manual_adjustment_value,
        manual_deletion_value,
        actual_closing_value,
        notes
    )
    SELECT 
        week_end_date,
        prev_closing,
        -- Revenue from View
        COALESCE((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date), 0),
        -- COGS / Sold Value
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = sold_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Sold Value
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = sold_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Produced Value
        COALESCE((SELECT SUM(inventory_value) FROM inventory WHERE produced BETWEEN start_date AND end_date), 0),
        -- Issued Value
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = issued_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Void Value
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = ANY(void_status_ids) AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Manual Adjustments (Net)
        COALESCE((
            SELECT SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric)
            FROM inventory_audit 
            WHERE action = 'UPDATE' AND changed_at BETWEEN start_date AND end_date
            AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields))
        ), 0),
        -- Manual Deletions (Positive value representing loss)
        COALESCE((
            SELECT SUM((old_data->>'inventory_value')::numeric)
            FROM inventory_audit 
            WHERE action = 'DELETE' AND changed_at BETWEEN start_date AND end_date
        ), 0),
        -- Actual In Stock Value
        COALESCE((SELECT SUM(total_value) FROM inventory_report_view WHERE current_status = 'In Stock'), 0),
        'Audit-Enabled Snapshot'
    ON CONFLICT (week_ending) DO UPDATE SET
        starting_value = EXCLUDED.starting_value,
        sales_value = EXCLUDED.sales_value,
        cogs_value = EXCLUDED.cogs_value,
        sold_value = EXCLUDED.sold_value,
        produced_value = EXCLUDED.produced_value,
        issued_value = EXCLUDED.issued_value,
        void_value = EXCLUDED.void_value,
        manual_adjustment_value = EXCLUDED.manual_adjustment_value,
        manual_deletion_value = EXCLUDED.manual_deletion_value,
        actual_closing_value = EXCLUDED.actual_closing_value,
        notes = 'Updated ' || now() || ' with audit logic';
END;
$function$;
    `;
    await sql.unsafe(function_sql);
    console.log('   ✅ Function updated.');

    console.log('4. Updating owner_weekly_trend_report view schema...');
    // Drop and recreate because column list changed
    await sql`DROP VIEW IF EXISTS public.owner_weekly_trend_report`;
    const view_sql = `
CREATE OR REPLACE VIEW public.owner_weekly_trend_report AS
 SELECT s.week_ending,
    s.sales_value AS "Weekly Revenue",
    s.gross_profit AS "Gross Profit",
    s.starting_value AS "Opening Inv",
    s.actual_closing_value AS "Closing Inv",
    round((((s.actual_closing_value - s.starting_value) / NULLIF(s.starting_value, (0)::numeric)) * (100)::numeric), 2) AS "Inv Growth %",
    (s.produced_value - s.sold_value - s.issued_value - s.void_value) AS "Expected Change",
    ((s.starting_value + s.produced_value - s.sold_value - s.issued_value - s.void_value + s.manual_adjustment_value - s.manual_deletion_value) - s.actual_closing_value) AS "Shrinkage/Discrepancy",
    s.manual_adjustment_value AS "Manual Adjustments",
    s.manual_deletion_value AS "Deletions",
    s.notes
   FROM public.inventory_weekly_snapshots s
  ORDER BY s.week_ending DESC;
    `;
    await sql.unsafe(view_sql);
    console.log('   ✅ View updated.');

  } catch (e) {
    console.error('❌ Error applying audit integration:', e.message);
  } finally {
    await sql.end();
  }
}
run();
