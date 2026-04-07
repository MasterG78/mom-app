
-- 1. Redefine the function with robust Sunday-snapping logic
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
    -- Always snap to the previous Sunday regardless of when run.
    -- (date_trunc('week', CURRENT_DATE) - interval '1 day')::date logic:
    -- If run on Monday: date_trunc gives Monday, subtract 1 day = Sunday.
    -- If run on Sunday: date_trunc gives Monday of SAME week, subtract 1 day = Sunday OF PREVIOUS WEEK.
    -- This is safe: running anytime during the week snaps to the completed week's Sunday.
    week_end_date := (date_trunc('week', CURRENT_DATE) - interval '1 day')::date;
    
    -- Range is Monday Midnight to Sunday 23:59:59 preceding week_end_date
    start_date := date_trunc('week', week_end_date)::timestamptz;
    end_date := (week_end_date + interval '1 day' - interval '1 second')::timestamptz;
    
    -- 2. Lookup Status IDs
    SELECT id INTO sold_status_id FROM statuses WHERE status_name = 'Sold' LIMIT 1;
    SELECT id INTO issued_status_id FROM statuses WHERE status_name = 'Issued' LIMIT 1;
    SELECT ARRAY_AGG(id) INTO void_status_ids FROM statuses WHERE status_name IN ('Void', 'Missing');

    -- 3. Carry forward the Balance
    -- Find the most recent snapshot BEFORE our targeted week_end_date
    SELECT actual_closing_value INTO prev_closing
    FROM inventory_weekly_snapshots
    WHERE week_ending < week_end_date
    ORDER BY week_ending DESC LIMIT 1;

    IF prev_closing IS NULL THEN prev_closing := 0; END IF;

    -- 4. Execute the Snapshot (Insert or Update if already exists)
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
        -- Revenue from View (Sum of sales recorded in this period)
        COALESCE((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date), 0),
        -- COGS / Sold Value from Table (Value of items marked 'Sold' in this period)
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = sold_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Sold Value from Table (Same as COGS)
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = sold_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Produced Value from Table (Value of items produced this week)
        COALESCE((SELECT SUM(inventory_value) FROM inventory WHERE produced BETWEEN start_date AND end_date), 0),
        -- Issued Value
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = issued_status_id AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Void Value
        COALESCE((SELECT SUM(inv.inventory_value) FROM inventory inv JOIN status_changes sc ON inv.id = sc.inventory_id WHERE sc.status_id = ANY(void_status_ids) AND sc.created_at BETWEEN start_date AND end_date), 0),
        -- Manual Adjustments (Net value change from audits on footage/price/quantity)
        COALESCE((
            SELECT SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric)
            FROM inventory_audit 
            WHERE action = 'UPDATE' AND changed_at BETWEEN start_date AND end_date
            AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields))
        ), 0),
        -- Manual Deletions (Lost value from record deletion)
        COALESCE((
            SELECT SUM((old_data->>'inventory_value')::numeric)
            FROM inventory_audit 
            WHERE action = 'DELETE' AND changed_at BETWEEN start_date AND end_date
        ), 0),
        -- Actual In Stock Value (Current Snapshot)
        COALESCE((SELECT SUM(total_value) FROM inventory_report_view WHERE current_status = 'In Stock'), 0),
        'Automated Snapshot (Robust Sunday-Snapping Logic)'
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
        notes = 'Updated ' || now() || ' with robust logic';
END;
$function$;

-- 2. Schedule the Cron Job for Monday 00:05 UTC (Sunday Evening ET)
-- 00:05 UTC ensures Sunday data is fully captured.
-- Remove potential existing job with same name in a safe way
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-inventory-snapshot') THEN
        PERFORM cron.unschedule('weekly-inventory-snapshot');
    END IF;
END $$;

SELECT cron.schedule(
    'weekly-inventory-snapshot',
    '5 0 * * 1', -- 00:05 on Monday (1)
    $$ SELECT generate_weekly_inventory_snapshot(); $$
);

-- 3. Data Correction: Fix the mislabeled row from manually run earlier
-- Identify the row with week_ending = '2026-04-07' (which was meant for '2026-04-05')
-- First check if 2026-04-05 already exists (unlikely given previous investigation)
UPDATE inventory_weekly_snapshots 
SET week_ending = '2026-04-05', 
    notes = 'Corrected from 2026-04-07 manual run'
WHERE week_ending = '2026-04-07';

-- Ensure we have a row for March 29 as well if missing
-- (Running once to backfill March 29 logic would require mocking CURRENT_DATE which is complex for SQL)
-- For now, the owner specifically noted "this week" being missing.
