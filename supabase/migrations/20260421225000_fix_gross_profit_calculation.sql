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
    m_adj numeric;
    m_del numeric;
    m_produced numeric;
    m_revenue numeric;
    m_gross_profit numeric;
    
    b_opening numeric;
    b_closing numeric;
 BEGIN
    -- 1. Setup Timeframe (Snaps to previous Sunday)
    week_end_date := (date_trunc('week', run_date) - interval '1 day')::date;
    start_date := date_trunc('week', week_end_date)::timestamptz;
    end_date := (week_end_date + interval '1 day' - interval '1 second')::timestamptz;
    
    -- 2. Calculate Balances
    b_opening := public.calculate_inventory_value_at(start_date);
    b_closing := public.calculate_inventory_value_at(end_date);

    -- 3. Calculate Known Movements
    -- Sold (COGS)
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_sold 
    FROM status_changes sc JOIN inventory i ON sc.inventory_id = i.id
    WHERE sc.status_id = (SELECT id FROM statuses WHERE status_name = 'Sold') 
    AND sc.created_at BETWEEN start_date AND end_date;
    
    -- Issued
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_issued 
    FROM status_changes sc JOIN inventory i ON sc.inventory_id = i.id
    WHERE sc.status_id = (SELECT id FROM statuses WHERE status_name = 'Issued') 
    AND sc.created_at BETWEEN start_date AND end_date;
    
    -- Voided
    SELECT COALESCE(round(SUM(i.inventory_value)::numeric, 2), 0) INTO m_voided 
    FROM status_changes sc JOIN inventory i ON sc.inventory_id = i.id
    WHERE sc.status_id IN (SELECT id FROM statuses WHERE status_name IN ('Void', 'Missing')) 
    AND sc.created_at BETWEEN start_date AND end_date;
    
    -- Manual Adjustments
    SELECT COALESCE(round(SUM((new_data->>'inventory_value')::numeric - (old_data->>'inventory_value')::numeric)::numeric, 2), 0) INTO m_adj
    FROM inventory_audit 
    WHERE action = 'UPDATE' AND changed_at BETWEEN start_date AND end_date
    AND ('inventory_value' = ANY(changed_fields) OR 'boardfeet' = ANY(changed_fields) OR 'quantity' = ANY(changed_fields));
    
    -- Manual Deletions
    SELECT COALESCE(round(SUM((old_data->>'inventory_value')::numeric)::numeric, 2), 0) INTO m_del
    FROM inventory_audit 
    WHERE action = 'DELETE' AND changed_at BETWEEN start_date AND end_date;

    -- 4. Calculate Revenue
    SELECT COALESCE(round((SELECT SUM(item_sale_price) FROM inventory_tag_sales_report WHERE sale_date BETWEEN start_date AND end_date)::numeric, 2), 0) INTO m_revenue;

    -- 5. Derive Production and Gross Profit
    m_produced := round(((b_closing - b_opening) + m_sold + m_issued + m_voided - m_adj + m_del)::numeric, 2);
    m_gross_profit := round((m_revenue - m_sold)::numeric, 2);

    -- 6. Execute Snapshot
    INSERT INTO inventory_weekly_snapshots (
        week_ending,
        starting_value,
        sales_value,
        sold_value,
        cogs_value,
        produced_value,
        issued_value,
        void_value,
        manual_adjustment_value,
        manual_deletion_value,
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
        m_produced,
        m_issued,
        m_voided,
        m_adj,
        m_del,
        b_closing,
        m_gross_profit,
        'Robust Snapshot (Balanced Logic with Gross Profit)'
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
        gross_profit = EXCLUDED.gross_profit,
        notes = 'Recalculated ' || now();
 END;
 $function$;

-- 2. Update the Report View to calculate Gross Profit if the column is null
CREATE OR REPLACE VIEW public.owner_weekly_trend_report AS
 SELECT s.week_ending,
    round(s.sales_value::numeric, 2) AS "Weekly Revenue",
    round(COALESCE(s.gross_profit, s.sales_value - s.sold_value)::numeric, 2) AS "Gross Profit",
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
