-- Migration: Inventory Balance Report Support
-- --------------------------------------------------------------------------------

-- 1. Add discovery_value column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_weekly_snapshots' AND column_name = 'discovery_value') THEN
        ALTER TABLE public.inventory_weekly_snapshots ADD COLUMN discovery_value numeric DEFAULT 0;
    END IF;
END $$;

-- 2. Update the Weekly Snapshot Function to be fully balanced
CREATE OR REPLACE FUNCTION public.generate_weekly_inventory_snapshot(run_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 AS $function$
 DECLARE
    start_date timestamptz;
    end_date timestamptz;
    week_end_date date;
    
    m_sold numeric;
    m_issued numeric;
    m_voided numeric;
    m_produced_true numeric; 
    m_adj numeric;       -- Value changes from audits
    m_del numeric;       -- Value lost from deletions
    m_discovery numeric; -- Value added from late entries
    
    b_opening numeric;
    b_closing numeric;
 BEGIN
    -- 1. Setup Timeframe (Snaps to previous Sunday)
    week_end_date := (date_trunc('week', run_date) - interval '1 day')::date;
    start_date := date_trunc('week', week_end_date)::timestamptz;
    end_date := (week_end_date + interval '1 day' - interval '1 second')::timestamptz;
    
    -- 2. Calculate Balances using Reconstruction
    b_opening := public.calculate_inventory_value_at(start_date);
    b_closing := public.calculate_inventory_value_at(end_date);

    -- 3. Calculate Known Movements
    -- Sold (COGS)
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_sold 
    FROM status_changes sc JOIN inventory i ON sc.inventory_id = i.id
    WHERE sc.status_id = (SELECT id FROM statuses WHERE status_name = 'Sold') 
    AND sc.created_at BETWEEN start_date AND end_date;
    
    -- Issued (Removals)
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_issued 
    FROM status_changes sc JOIN inventory i ON sc.inventory_id = i.id
    WHERE sc.status_id = (SELECT id FROM statuses WHERE status_name = 'Issued') 
    AND sc.created_at BETWEEN start_date AND end_date;
    
    -- Voided (Waste)
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_voided 
    FROM status_changes sc JOIN inventory i ON sc.inventory_id = i.id
    WHERE sc.status_id IN (SELECT id FROM statuses WHERE status_name IN ('Void', 'Missing')) 
    AND sc.created_at BETWEEN start_date AND end_date;
    
    -- True Production (Items manufactured this week)
    SELECT COALESCE(round(SUM(inventory_value)::numeric, 2), 0) INTO m_produced_true
    FROM inventory 
    WHERE produced BETWEEN start_date AND end_date;

    -- Audit Adjustments (Net value change from updates)
    SELECT COALESCE(round(SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric), 2), 0) INTO m_adj
    FROM inventory_audit 
    WHERE action = 'UPDATE' AND changed_at BETWEEN start_date AND end_date
    AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields));
    
    -- Manual Deletions (Lost value)
    SELECT COALESCE(round(SUM((old_data->>'inventory_value')::numeric), 2), 0) INTO m_del
    FROM inventory_audit 
    WHERE action = 'DELETE' AND changed_at BETWEEN start_date AND end_date;

    -- Discoveries (Items entered this week but produced earlier)
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_discovery
    FROM inventory i
    JOIN status_changes sc ON i.id = sc.inventory_id
    WHERE sc.status_id = (SELECT id FROM statuses WHERE status_name = 'In Stock')
    AND sc.created_at BETWEEN start_date AND end_date
    AND i.produced < start_date
    AND NOT EXISTS (
        SELECT 1 FROM status_changes sc2 
        WHERE sc2.inventory_id = i.id AND sc2.created_at < start_date
    );

    -- 6. Execute Snapshot
    INSERT INTO inventory_weekly_snapshots (
        week_ending,
        starting_value,
        sales_value, -- Revenue
        sold_value,  -- COGS
        cogs_value,  -- Deprecated duplicate
        produced_value, -- "True Production"
        issued_value,
        void_value,
        manual_adjustment_value,
        manual_deletion_value,
        discovery_value,
        actual_closing_value,
        notes
    )
    VALUES (
        week_end_date,
        b_opening,
        COALESCE(round((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date)::numeric, 2), 0),
        m_sold,
        m_sold,
        m_produced_true,
        m_issued,
        m_voided,
        m_adj,
        m_del,
        m_discovery,
        b_closing,
        'Fully Balanced Snapshot (Production vs Discovery vs Audit)'
    )
    ON CONFLICT (week_ending) DO UPDATE SET
        starting_value = EXCLUDED.starting_value,
        sales_value = EXCLUDED.sales_value,
        sold_value = EXCLUDED.sold_value,
        cogs_value = EXCLUDED.cogs_value,
        produced_value = EXCLUDED.produced_value,
        issued_value = EXCLUDED.issued_value,
        void_value = EXCLUDED.void_value,
        manual_adjustment_value = EXCLUDED.manual_adjustment_value,
        manual_deletion_value = EXCLUDED.manual_deletion_value,
        discovery_value = EXCLUDED.discovery_value,
        actual_closing_value = EXCLUDED.actual_closing_value,
        notes = 'Recalculated ' || now();
 END;
 $function$;

-- 3. Create the Inventory Balance Report View
CREATE OR REPLACE VIEW public.owner_weekly_inventory_balance_report AS
 SELECT 
    s.week_ending,
    round(s.starting_value::numeric, 2) AS "Opening Inv",
    round(s.produced_value::numeric, 2) AS "Production",
    round(s.sold_value::numeric, 2) AS "Sold (Inv Val)",
    round(s.issued_value::numeric, 2) AS "Issued",
    round(s.void_value::numeric, 2) AS "Voided",
    round((s.manual_adjustment_value - s.manual_deletion_value + s.discovery_value)::numeric, 2) AS "Adjustments",
    round(s.actual_closing_value::numeric, 2) AS "Closing Inv",
    -- Sanity Check Columns
    round(s.sales_value::numeric, 2) AS "Actual Revenue",
    round(s.sold_value::numeric, 2) AS "Inventory Value of Sales",
    round((s.sales_value - s.sold_value)::numeric, 2) AS "Sales Variance"
 FROM public.inventory_weekly_snapshots s
 ORDER BY s.week_ending DESC;

-- 4. Schedule the report generation (if not already scheduled by trend report)
-- The trend report already triggers generate_weekly_inventory_snapshot() in its cron.
-- We just need a new cron to trigger the new Edge Function.
-- This will be handled in the next step when we have the function URL.
