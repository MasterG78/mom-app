-- =============================================================================
-- MIGRATION: sync_invoice_line_items.sql
-- Description: 
--   1. Drop obsolete qbo_invoices table, trigger, and functions.
--   2. Rename inventory.invoice_id -> invoice_number and change type to text.
--   3. Create new trigger on invoice_line_items to sync inventory and audit trail.
--   4. Rebuild views that previously joined qbo_invoices.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1: Drop obsolete qbo_invoices infrastructure
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'qbo_invoices') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trigger_link_qbo_invoice ON qbo_invoices';
    END IF;
END $$;

DROP FUNCTION IF EXISTS link_qbo_invoice_to_inventory();
DROP FUNCTION IF EXISTS upsert_invoices_bulk(jsonb);

-- Drop views that join qbo_invoices BEFORE dropping the table
DROP VIEW IF EXISTS inventory_tag_sales_report;
DROP VIEW IF EXISTS inventory_report_view;

DROP TABLE IF EXISTS qbo_invoices;


-- -----------------------------------------------------------------------------
-- STEP 2: Rename and retype inventory.invoice_id -> invoice_number
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Check if invoice_id exists before renaming
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'invoice_id'
    ) THEN
        ALTER TABLE inventory RENAME COLUMN invoice_id TO invoice_number;
    END IF;

    -- Always ensure it's text type
    ALTER TABLE inventory ALTER COLUMN invoice_number TYPE text USING invoice_number::text;
END $$;


-- -----------------------------------------------------------------------------
-- STEP 3: Rebuild views (no longer joining qbo_invoices)
-- -----------------------------------------------------------------------------

-- 3a. inventory_report_view
CREATE OR REPLACE VIEW inventory_report_view AS
SELECT
    i.id,
    i.tag,
    i.invoice_number,           -- direct text snapshot from inventory
    i.line,
    i.produced,
    p.product_name,
    i.boardfeet,
    i.quantity,
    s.status_name AS current_status,
    i.inventory_value AS total_value,
    i.sales_value,
    i.customer_name,
    i.length,
    i.width,
    i.rows,
    i.note,
    sp.species_name
FROM inventory i
LEFT JOIN products p  ON i.product_id  = p.id
LEFT JOIN species sp  ON i.species_id  = sp.id
LEFT JOIN (
    SELECT DISTINCT ON (inventory_id)
        inventory_id,
        status_id
    FROM status_changes
    ORDER BY inventory_id, created_at DESC
) latest_status ON i.id = latest_status.inventory_id
LEFT JOIN statuses s ON latest_status.status_id = s.id;


-- 3b. inventory_tag_sales_report
--     Previously pulled invoice number from qbo_invoices.raw_data.
--     Now reads directly from inventory.invoice_number.
CREATE OR REPLACE VIEW inventory_tag_sales_report AS
SELECT
    i.tag,
    p.product_name,
    i.sales_value AS item_sale_price,
    i.invoice_number,           -- renamed from qbo_invoice_number
    i.customer_name,
    sc_latest.updated_at AS sale_date
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id
LEFT JOIN (
    SELECT DISTINCT ON (inventory_id)
        inventory_id,
        updated_at
    FROM status_changes
    WHERE status_id = (SELECT id FROM statuses WHERE status_name = 'Sold' LIMIT 1)
    ORDER BY inventory_id, updated_at DESC
) sc_latest ON i.id = sc_latest.inventory_id
WHERE i.invoice_number IS NOT NULL;


-- -----------------------------------------------------------------------------
-- STEP 4: Create trigger function on invoice_line_items
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_invoice_line_item_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
    inventory_record  record;
    sold_status_id    bigint;
BEGIN
    -- Only process rows that have a valid numeric tag_number
    IF NEW.tag_number IS NULL OR NOT (NEW.tag_number ~ '^[0-9]+$') THEN
        RETURN NEW;
    END IF;

    -- Look up the matching inventory record by tag number
    SELECT * INTO inventory_record
    FROM inventory
    WHERE tag = NEW.tag_number::integer
    LIMIT 1;

    IF NOT FOUND THEN
        -- No matching inventory item; skip silently
        RETURN NEW;
    END IF;

    -- Update the inventory record with invoice snapshot data
    UPDATE inventory
    SET
        invoice_number = NEW.invoice_number,
        sales_value    = NEW.amount,
        customer_name  = NEW.customer_name
    WHERE id = inventory_record.id;

    -- Look up the 'Sold' status id
    SELECT id INTO sold_status_id
    FROM statuses
    WHERE status_name = 'Sold'
    LIMIT 1;

    IF sold_status_id IS NOT NULL THEN
        -- Check if a 'Sold' entry for this invoice already exists to prevent duplicates
        IF NOT EXISTS (
            SELECT 1 FROM status_changes 
            WHERE inventory_id = inventory_record.id 
            AND status_id = sold_status_id 
            AND notes LIKE '%Invoice #' || NEW.invoice_number || '%'
        ) THEN
            INSERT INTO status_changes (inventory_id, status_id, updated_by, notes)
            VALUES (
                inventory_record.id,
                sold_status_id,
                COALESCE(auth.uid(), '71c80b7d-61ac-47cf-9998-f482553fc54a'::uuid),
                'Sold on Invoice #' || NEW.invoice_number
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- STEP 5: Attach trigger to invoice_line_items
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_sync_invoice_line_item ON invoice_line_items;
CREATE TRIGGER trigger_sync_invoice_line_item
AFTER INSERT OR UPDATE ON invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_line_item_to_inventory();
