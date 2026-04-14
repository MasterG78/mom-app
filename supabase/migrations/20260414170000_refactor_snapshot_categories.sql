
-- Migration: Refactor Weekly Snapshot Categories
-- --------------------------------------------------------------------------------
-- 1. Separates "True Production" from "Adjustments" (Discoveries, Audits, Deletions).
-- 2. Renames report columns for better owner visibility.
-- 3. Adds a drill-down view to explain the "Adjustments" column.

-- 0. Drop old ambiguous function versions if they exist
DROP FUNCTION IF EXISTS public.generate_weekly_inventory_snapshot();

-- 1. Update the Weekly Snapshot Function
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
    m_adjustments numeric; -- The "Other" bucket
    
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
    
    -- 4. Calculate TRUE Production (Items manufactured this week)
    SELECT COALESCE(round(SUM(inventory_value)::numeric, 2), 0) INTO m_produced_true
    FROM inventory 
    WHERE produced BETWEEN start_date AND end_date;

    -- 5. Calculate Adjustments (The "Other" plug to balance the sheet)
    m_adjustments := round((b_closing - b_opening - m_produced_true + m_sold + m_issued + m_voided)::numeric, 2);

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
        manual_adjustment_value, -- "Adjustments" (Discoveries + Audits)
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
        m_adjustments,
        b_closing,
        'Categorized Snapshot (Production vs Adjustments)'
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
        actual_closing_value = EXCLUDED.actual_closing_value,
        notes = 'Recalculated ' || now();
 END;
 $function$;

-- 2. Update the Report View
DROP VIEW IF EXISTS public.owner_weekly_trend_report;
CREATE OR REPLACE VIEW public.owner_weekly_trend_report AS
 SELECT s.week_ending,
    round(s.sales_value::numeric, 2) AS "Weekly Revenue",
    round((s.sales_value - s.sold_value)::numeric, 2) AS "Gross Profit",
    round(s.starting_value::numeric, 2) AS "Opening Inv",
    round(s.actual_closing_value::numeric, 2) AS "Closing Inv",
    round((((s.actual_closing_value - s.starting_value) / NULLIF(s.starting_value, (0)::numeric)) * (100)::numeric), 2) AS "Inv Growth %",
    round(s.produced_value::numeric, 2) AS "Production",
    round(s.manual_adjustment_value::numeric, 2) AS "Adjustments",
    round((s.sold_value + s.issued_value + s.void_value)::numeric, 2) AS "Total Outflows",
    s.notes
   FROM public.inventory_weekly_snapshots s
  ORDER BY s.week_ending DESC;

-- 3. Create the Adjustment Details Drill-down View
CREATE OR REPLACE VIEW public.owner_weekly_adjustment_details AS
 WITH weekly_ranges AS (
     SELECT 
        week_ending,
        date_trunc('week', week_ending)::timestamptz as start_date,
        (week_ending + interval '1 day' - interval '1 second')::timestamptz as end_date
     FROM (SELECT DISTINCT week_ending FROM inventory_weekly_snapshots) weeks
 ),
 audits AS (
     SELECT 
        w.week_ending,
        a.changed_at as activity_date,
        (a.new_data->>'tag')::text as tag,
        'Audit Revaluation' as category,
        ((a.new_data->>'inventory_value')::numeric - (a.old_data->>'inventory_value')::numeric) as value_change,
        'Audit of: ' || array_to_string(a.changed_fields, ', ') as explanation
     FROM inventory_audit a
     JOIN weekly_ranges w ON a.changed_at BETWEEN w.start_date AND w.end_date
     WHERE a.action = 'UPDATE' 
     AND ('inventory_value' = ANY(a.changed_fields) OR 'boardfeet' = ANY(a.changed_fields) OR 'quantity' = ANY(a.changed_fields))
 ),
 deletions AS (
     SELECT 
        w.week_ending,
        a.changed_at as activity_date,
        (a.old_data->>'tag')::text as tag,
        'Manual Deletion' as category,
        (-(a.old_data->>'inventory_value')::numeric) as value_change,
        'Record was deleted from system' as explanation
     FROM inventory_audit a
     JOIN weekly_ranges w ON a.changed_at BETWEEN w.start_date AND w.end_date
     WHERE a.action = 'DELETE'
 ),
 discoveries AS (
     SELECT 
        w.week_ending,
        sc.created_at as activity_date,
        i.tag::text as tag,
        'Back-dated Entry / Discovery' as category,
        i.inventory_value as value_change,
        'Item entered this week but produced on ' || i.produced::date as explanation
     FROM inventory i
     JOIN status_changes sc ON i.id = sc.inventory_id
     JOIN weekly_ranges w ON sc.created_at BETWEEN w.start_date AND w.end_date
     WHERE sc.status_id = (SELECT id FROM statuses WHERE status_name = 'In Stock')
     AND i.produced < w.start_date
     AND NOT EXISTS (
         SELECT 1 FROM status_changes sc2 
         WHERE sc2.inventory_id = i.id AND sc2.created_at < w.start_date
     )
 )
 SELECT * FROM audits
 UNION ALL
 SELECT * FROM deletions
 UNION ALL 
 SELECT * FROM discoveries;
