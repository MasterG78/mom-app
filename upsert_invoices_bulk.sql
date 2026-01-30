-- FUNCTION: upsert_invoices_bulk
-- Description: Accepts a JSON array of invoices (from Make.com) and upserts them into qbo_invoices.
--            This allows processing hundreds of invoices in a single API call.

CREATE OR REPLACE FUNCTION upsert_invoices_bulk(invoices jsonb)
RETURNS void AS $$
DECLARE
    invoice_item jsonb;
BEGIN
    -- Loop through the JSON array
    FOR invoice_item IN SELECT * FROM jsonb_array_elements(invoices)
    LOOP
        INSERT INTO qbo_invoices (id, raw_data, updated_at)
        VALUES (
            (invoice_item->>'Id')::int,  -- Cast ID to integer
            invoice_item,                -- Store the full JSON object
            now()
        )
        ON CONFLICT (id) 
        DO UPDATE SET 
            raw_data = EXCLUDED.raw_data,
            updated_at = now();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- NOTE: 
-- The existing trigger 'trigger_link_qbo_invoice' runs AFTER INSERT.
-- If you want this sweep to also re-process links for UPDATED invoices,
-- you should update the trigger definition to:
-- DROP TRIGGER IF EXISTS trigger_link_qbo_invoice ON qbo_invoices;
-- CREATE TRIGGER trigger_link_qbo_invoice AFTER INSERT OR UPDATE ON qbo_invoices ...
