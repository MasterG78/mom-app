
-- Migration: Round decimals in Weekly Trend Report 
-- --------------------------------------------------------------------------------
-- Fixes long floating point artifacts by applying round(..., 2) to all movements, 
-- balances, and report calculations.

-- 1. Update Reconstruction Helper with Rounding
CREATE OR REPLACE FUNCTION public.calculate_inventory_value_at(target_time timestamptz)
 RETURNS numeric
 LANGUAGE plpgsql
 AS $function$
 DECLARE
    in_stock_val numeric;
    deleted_items_val numeric;
    in_stock_status_id int;
 BEGIN
    SELECT id INTO in_stock_status_id FROM statuses WHERE status_name = 'In Stock' LIMIT 1;

    -- A. Combined value of all items (currently existing) that were 'In Stock' at T
    WITH latest_status_at_t AS (
        SELECT DISTINCT ON (inventory_id) inventory_id, status_id
        FROM status_changes
        WHERE created_at <= target_time
        ORDER BY inventory_id, created_at DESC
    )
    SELECT COALESCE(SUM(i.inventory_value), 0) INTO in_stock_val
    FROM inventory i
    LEFT JOIN latest_status_at_t ls ON i.id = ls.inventory_id
    WHERE i.produced <= target_time
    AND (
        ls.status_id IS NULL -- Stayed in original In Stock state since production
        OR ls.status_id = in_stock_status_id -- Its last state at T was In Stock
    );

    -- B. Value of items that were DELETED after T (so they were there at T)
    SELECT COALESCE(SUM((old_data->>'inventory_value')::numeric), 0) INTO deleted_items_val
    FROM inventory_audit
    WHERE action = 'DELETE'
    AND changed_at > target_time
    AND (old_data->>'produced')::timestamptz <= target_time;

    -- C. Reverse any value-based updates (Price/Footage) that happened after T
    -- Round final result to 2 decimals
    RETURN round(CAST(in_stock_val + deleted_items_val - (
        SELECT COALESCE(SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric), 0)
        FROM inventory_audit 
        WHERE action = 'UPDATE' 
        AND changed_at > target_time
        AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields))
        AND (new_data->>'produced')::timestamptz <= target_time
    ) AS numeric), 2);
 END;
 $function$;

-- 2. Update Snapshot Logic with Rounding
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
    m_adj numeric;
    m_del numeric;
    m_produced numeric; -- Derived/Plug value
    
    b_opening numeric;
    b_closing numeric;
 BEGIN
    -- 1. Setup Timeframe (Snaps to previous Sunday)
    week_end_date := (date_trunc('week', run_date) - interval '1 day')::date;
    start_date := date_trunc('week', week_end_date)::timestamptz;
    end_date := (week_end_date + interval '1 day' - interval '1 second')::timestamptz;
    
    -- 2. Calculate Balances using Reconstruction (Already rounded by helper)
    b_opening := public.calculate_inventory_value_at(start_date);
    b_closing := public.calculate_inventory_value_at(end_date);

    -- 3. Calculate Known Movements with Rounding
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
    
    -- Manual Adjustments (Value changes)
    SELECT COALESCE(round(SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric)::numeric, 2), 0) INTO m_adj
    FROM inventory_audit 
    WHERE action = 'UPDATE' AND changed_at BETWEEN start_date AND end_date
    AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields));
    
    -- Manual Deletions
    SELECT COALESCE(round(SUM((old_data->>'inventory_value')::numeric)::numeric, 2), 0) INTO m_del
    FROM inventory_audit 
    WHERE action = 'DELETE' AND changed_at BETWEEN start_date AND end_date;

    -- 4. Derive Production (The "Plug" value to balance the sheet)
    m_produced := round(((b_closing - b_opening) + m_sold + m_issued + m_voided - m_adj + m_del)::numeric, 2);

    -- 5. Execute Snapshot
    INSERT INTO inventory_weekly_snapshots (
        week_ending,
        starting_value,
        sales_value, -- Revenue
        sold_value,  -- COGS
        cogs_value,  -- Deprecated duplicate
        produced_value,
        issued_value,
        void_value,
        manual_adjustment_value,
        manual_deletion_value,
        actual_closing_value,
        notes
    )
    VALUES (
        week_end_date,
        b_opening,
        COALESCE(round((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date)::numeric, 2), 0),
        m_sold,
        m_sold,
        m_produced,
        m_issued,
        m_voided,
        m_adj,
        m_del,
        b_closing,
        'Robust Snapshot (Accountant-Grade Balanced Logic)'
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
        actual_closing_value = EXCLUDED.actual_closing_value,
        notes = 'Recalculated ' || now();
 END;
 $function$;

-- 3. Update Report View with Rounding on calculated fields
DROP VIEW IF EXISTS public.owner_weekly_trend_report;
CREATE OR REPLACE VIEW public.owner_weekly_trend_report AS
 SELECT s.week_ending,
    round(s.sales_value::numeric, 2) AS "Weekly Revenue",
    round(s.gross_profit::numeric, 2) AS "Gross Profit",
    round(s.starting_value::numeric, 2) AS "Opening Inv",
    round(s.actual_closing_value::numeric, 2) AS "Closing Inv",
    round((((s.actual_closing_value - s.starting_value) / NULLIF(s.starting_value, (0)::numeric)) * (100)::numeric), 2) AS "Inv Growth %",
    round((s.produced_value - s.sold_value - s.issued_value - s.void_value)::numeric, 2) AS "Expected Change",
    round(((s.starting_value + s.produced_value - s.sold_value - s.issued_value - s.void_value + s.manual_adjustment_value - s.manual_deletion_value) - s.actual_closing_value)::numeric, 2) AS "Shrinkage/Discrepancy",
    round(s.manual_adjustment_value::numeric, 2) AS "Manual Adjustments",
    round(s.manual_deletion_value::numeric, 2) AS "Deletions",
    s.notes
   FROM public.inventory_weekly_snapshots s
  ORDER BY s.week_ending DESC;
