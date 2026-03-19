-- =============================================================================
-- MIGRATION: update_invoice_matching_logic.sql
-- Description:
--   Refines sync_invoice_line_item_to_inventory() with updated rules:
--   1. If invoice number is NEW (inventory had none): mark Sold, note "Sold on Invoice #X"
--   2. If invoice number CHANGES to a different value: mark Sold again, note
--      "Sold on Invoice #X (Previously Invoice #Y)"
--   3. If invoice number is the SAME as already stored: skip inserting a new Sold status.
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_invoice_line_item_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
    inventory_record  record;
    sold_status_id    bigint;
    prev_invoice      text;
    note_text         text;
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

    -- Capture the PREVIOUS invoice number before we overwrite it
    prev_invoice := inventory_record.invoice_number;

    -- Update the inventory record with invoice snapshot data
    UPDATE inventory
    SET
        invoice_number = NEW.invoice_number,
        sales_value    = NEW.amount,
        customer_name  = NEW.customer_name
    WHERE id = inventory_record.id;

    -- Only proceed with status change if the invoice number is new or different
    IF prev_invoice IS DISTINCT FROM NEW.invoice_number THEN

        -- Look up the 'Sold' status id
        SELECT id INTO sold_status_id
        FROM statuses
        WHERE status_name = 'Sold'
        LIMIT 1;

        IF sold_status_id IS NOT NULL THEN
            -- Build the note
            IF prev_invoice IS NOT NULL AND prev_invoice <> '' THEN
                -- Invoice number is CHANGING — record the previous invoice
                note_text := 'Sold on Invoice #' || NEW.invoice_number
                             || ' (Previously Invoice #' || prev_invoice || ')';
            ELSE
                -- First time being linked to an invoice
                note_text := 'Sold on Invoice #' || NEW.invoice_number;
            END IF;

            INSERT INTO status_changes (inventory_id, status_id, updated_by, notes)
            VALUES (
                inventory_record.id,
                sold_status_id,
                COALESCE(auth.uid(), '71c80b7d-61ac-47cf-9998-f482553fc54a'::uuid),
                note_text
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_sync_invoice_line_item ON invoice_line_items;
CREATE TRIGGER trigger_sync_invoice_line_item
AFTER INSERT OR UPDATE ON invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_line_item_to_inventory();
