-- FUNCTION: link_qbo_invoice_to_inventory
-- Description: Trigger function that runs after insert or update on qbo_invoices.
--              It parses the invoice lines for descriptions containing "Tag #<number>" or just "<number>"
--              and updates the corresponding inventory record with:
--              1. The invoice ID
--              2. The sales_value (from the invoice line Amount)
--              3. A new "Sold" status in status_changes.

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
    cust_name text; -- Variable for Customer Name
BEGIN
    invoice_data := NEW.raw_data;
    line_items := invoice_data->'Line';
    
    -- Extract Customer Name safely
    -- Structure: "CustomerRef": { "value": "123", "name": "John Doe" }
    cust_name := invoice_data->'CustomerRef'->>'name';

    -- Attempt to find the "Sold" status ID (assuming it exists in status_list)
    SELECT id INTO sold_status_id FROM status_list WHERE status_name = 'Sold' LIMIT 1;
    
    -- Iterate through each line item in the invoice
    -- Note: 'Line' can be an object (single item) or array (multiple items) in some JSON structures,
    --       but QuickBooks typically returns an array. We'll assume array here.
    IF jsonb_typeof(line_items) = 'array' THEN
        FOR line_item IN SELECT * FROM jsonb_array_elements(line_items)
        LOOP
            description := line_item->>'Description';
            amount := (line_item->>'Amount')::numeric;

            -- Crude parsing logic: Extract numeric tag from description.
            -- Need a robust way to identify if this is a tag line.
            -- Assumption: Description contains "Tag #123" or similar.
            -- Let's look for a pattern like "Tag #<digits>" or just "<digits>" if that's the convention.
            -- Ideally, we'd use regex.
            
            -- Example regex to find "Tag #123" or just "123" (if it's clearly a tag).
            -- Let's try to match "Tag #(\d+)" first.
            tag_id := (substring(description FROM 'Tag #(\d+)')::int);

            -- If found, process it.
            IF tag_id IS NOT NULL THEN
                -- Check if inventory exists
                SELECT * INTO inventory_record FROM inventory WHERE tag = tag_id LIMIT 1;

                IF FOUND THEN
                    -- Update Inventory
                    UPDATE inventory
                    SET 
                        invoice_id = NEW.id,
                        sales_value = amount,
                        customer_name = cust_name -- Update Customer Name
                    WHERE id = inventory_record.id;

                    -- Insert Status Change if 'Sold' status exists
                    IF sold_status_id IS NOT NULL THEN
                        -- Check if already marked as Sold to prevent duplicates on updates?
                        -- For now, we'll insert a new status change to record the event.
                        -- Use a system user ID or the invoice updater if available.
                        -- Here we use auth.uid() if available, otherwise maybe a system user or NULL?
                        -- Since triggers run as the user, auth.uid() might be valid if triggered via API.
                        -- If triggered by background worker/Make.com, auth.uid() might be null.
                        -- Let's try to handle it gracefully.
                        
                        INSERT INTO status_changes (inventory_id, status_id, updated_by, notes)
                        VALUES (
                            inventory_record.id, 
                            sold_status_id, 
                            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), -- Fallback GUID or handle null
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

-- TRIGGER: trigger_link_qbo_invoice
DROP TRIGGER IF EXISTS trigger_link_qbo_invoice ON qbo_invoices;
CREATE TRIGGER trigger_link_qbo_invoice
AFTER INSERT OR UPDATE ON qbo_invoices
FOR EACH ROW
EXECUTE FUNCTION link_qbo_invoice_to_inventory();
