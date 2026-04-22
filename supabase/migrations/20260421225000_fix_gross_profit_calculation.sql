-- Fix Gross Profit calculation in Owner Weekly Report
-- This migration updates the view and the snapshot function to ensure Gross Profit is correctly calculated and stored.

-- 1. Update the snapshot function to explicitly calculate and store gross_profit
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
    m_revenue numeric;
    m_gross_profit numeric;
    
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

    -- 5. Calculate Revenue
    SELECT COALESCE(round((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date)::numeric, 2), 0) INTO m_revenue;

    -- 6. Calculate Adjustments (The "Other" plug to balance the sheet)
    m_adjustments := round((b_closing - b_opening - m_produced_true + m_sold + m_issued + m_voided)::numeric, 2);
    m_gross_profit := round((m_revenue - m_sold)::numeric, 2);

    -- 7. Execute Snapshot
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
        gross_profit,
        notes
    )
    VALUES (
        week_end_date,
        b_opening,
        m_revenue,
        m_sold,
        m_sold,
        m_produced_true,
        m_issued,
        m_voided,
        m_adjustments,
        b_closing,
        m_gross_profit,
        'Categorized Snapshot (Production vs Adjustments with Gross Profit)'
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
        gross_profit = EXCLUDED.gross_profit,
        notes = 'Recalculated ' || now();
 END;
 $function$;

-- 2. Update the Report View (Drop first to avoid column rename conflict)
DROP VIEW IF EXISTS public.owner_weekly_trend_report;
CREATE OR REPLACE VIEW public.owner_weekly_trend_report AS
 SELECT s.week_ending,
    round(s.sales_value::numeric, 2) AS "Weekly Revenue",
    round(COALESCE(s.gross_profit, s.sales_value - s.sold_value)::numeric, 2) AS "Gross Profit",
    round(s.starting_value::numeric, 2) AS "Opening Inv",
    round(s.actual_closing_value::numeric, 2) AS "Closing Inv",
    round((((s.actual_closing_value - s.starting_value) / NULLIF(s.starting_value, (0)::numeric)) * (100)::numeric), 2) AS "Inv Growth %",
    round(s.produced_value::numeric, 2) AS "Production",
    round(s.manual_adjustment_value::numeric, 2) AS "Adjustments",
    round((s.sold_value + s.issued_value + s.void_value)::numeric, 2) AS "Total Outflows",
    s.notes
   FROM public.inventory_weekly_snapshots s
  ORDER BY s.week_ending DESC;
