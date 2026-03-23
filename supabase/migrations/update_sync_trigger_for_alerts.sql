-- =============================================================================
-- MIGRATION: update_sync_trigger_for_alerts.sql
-- Description:
--   1. Create system_alerts table.
--   2. Update sync_invoice_line_item_to_inventory() to catch duplicate sales.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Create system_alerts table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT,
    reference_id TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Basic Policies for authenticated users
CREATE POLICY "Users can view alerts" ON system_alerts
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to resolve alerts
CREATE POLICY "Users can update alerts" ON system_alerts
    FOR UPDATE TO authenticated USING (true);

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON system_alerts TO authenticated;
GRANT ALL ON SEQUENCE system_alerts_id_seq TO authenticated;

-- -----------------------------------------------------------------------------
-- STEP 2: Update the sync trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_invoice_line_item_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
    inventory_record  record;
    sold_status_id    bigint;
    duplicate_count   int;
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

    -- -------------------------------------------------------------------------
    -- PRE-UPDATE CHECKS FOR SYSTEM ALERTS (Duplicate Sales)
    -- -------------------------------------------------------------------------

    -- Scenario 1: Already sold on a different invoice
    IF inventory_record.invoice_number IS NOT NULL AND inventory_record.invoice_number != NEW.invoice_number THEN
        INSERT INTO system_alerts (
            alert_type, title, message, target_role, reference_id
        ) VALUES (
            'DUPLICATE_SALE',
            'Duplicate Sale on Different Invoice',
            'Tag #' || inventory_record.tag || ' was already sold on Invoice #' || inventory_record.invoice_number || ' and is now being sold again on Invoice #' || NEW.invoice_number,
            'office',
            inventory_record.tag::text
        );
    
    -- Scenario 2: Put in twice on the SAME invoice
    ELSEIF inventory_record.invoice_number = NEW.invoice_number THEN
        -- We check if there's more than 1 entry in invoice_line_items for this tag on this invoice
        SELECT COUNT(*) INTO duplicate_count FROM invoice_line_items 
        WHERE invoice_number = NEW.invoice_number AND tag_number = NEW.tag_number;
        
        -- If count > 1, it means this is a duplicate on the same invoice.
        -- We also only flag if we haven't already raised an alert for this exact tag and invoice.
        IF duplicate_count > 1 AND NOT EXISTS (
            SELECT 1 FROM system_alerts WHERE alert_type = 'DUPLICATE_SALE' AND reference_id = NEW.tag_number AND message LIKE '%on the SAME invoice%'
        ) THEN
            INSERT INTO system_alerts (
                alert_type, title, message, target_role, reference_id
            ) VALUES (
                'DUPLICATE_SALE',
                'Duplicate Sale on Same Invoice',
                'Tag #' || inventory_record.tag || ' was added multiple times to Invoice #' || NEW.invoice_number,
                'office',
                inventory_record.tag::text
            );
        END IF;
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
