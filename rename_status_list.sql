-- Migration Script: Rename status_list to statuses
-- Description: Renames the 'status_list' table to 'statuses' and updates dependent views and functions.

-- 1. Rename the table
ALTER TABLE IF EXISTS "status_list" RENAME TO "statuses";

-- 2. Update dependent views
-- inventory_report_view
DROP VIEW IF EXISTS "inventory_report_view";
CREATE OR REPLACE VIEW "inventory_report_view" AS
SELECT
    i.id,
    i.tag,
    (q.raw_data->>'DocNumber') AS invoice_id,
    i.line,
    i.produced,
    p.product_name,
    i.boardfeet,
    i.quantity,
    s.status_name AS current_status,
    i.inventory_value AS total_value,
    i.sales_value,
    i.customer_name
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id
LEFT JOIN
    qbo_invoices q ON i.invoice_id = q.id
LEFT JOIN
    (
        SELECT DISTINCT ON (inventory_id) inventory_id, status_id
        FROM status_changes
        ORDER BY inventory_id, updated_at DESC
    ) latest_status ON i.id = latest_status.inventory_id
LEFT JOIN
    statuses s ON latest_status.status_id = s.id;

-- status_history_view
DROP VIEW IF EXISTS "status_history_view";
CREATE OR REPLACE VIEW "status_history_view" AS
SELECT
    sc.id,
    sc.inventory_id,
    sc.updated_at,
    sc.notes,
    s.status_name,
    s.status_description,
    pr.full_name AS updater_name
FROM
    status_changes sc
JOIN
    statuses s ON sc.status_id = s.id
LEFT JOIN
    profiles pr ON sc.updated_by = pr.id;

-- 3. Update Trigger Function 'link_qbo_invoice_to_inventory'
-- We just need to replace 'status_list' with 'statuses'
CREATE OR REPLACE FUNCTION link_qbo_invoice_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
    invoice_data jsonb;
    line_items jsonb;
    line_item jsonb;
    description text;
    amount numeric;
    tag_id int;
    inventory_record record;
    sold_status_id int;
    user_id uuid;
    cust_name text;
BEGIN
    invoice_data := NEW.raw_data;
    line_items := invoice_data->'Line';
    
    cust_name := invoice_data->'CustomerRef'->>'name';

    -- Updated table name here:
    SELECT id INTO sold_status_id FROM statuses WHERE status_name = 'Sold' LIMIT 1;
    
    IF jsonb_typeof(line_items) = 'array' THEN
        FOR line_item IN SELECT * FROM jsonb_array_elements(line_items)
        LOOP
            description := line_item->>'Description';
            amount := (line_item->>'Amount')::numeric;
            tag_id := (substring(description FROM 'Tag #(\d+)')::int);

            IF tag_id IS NOT NULL THEN
                SELECT * INTO inventory_record FROM inventory WHERE tag = tag_id LIMIT 1;

                IF FOUND THEN
                    UPDATE inventory
                    SET 
                        invoice_id = NEW.id,
                        sales_value = amount,
                        customer_name = cust_name
                    WHERE id = inventory_record.id;

                    IF sold_status_id IS NOT NULL THEN
                        INSERT INTO status_changes (inventory_id, status_id, updated_by, notes)
                        VALUES (
                            inventory_record.id, 
                            sold_status_id, 
                            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
                            'Sold on Invoice #' || (invoice_data->>'DocNumber')
                        );
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
