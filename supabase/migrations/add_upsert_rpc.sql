-- =============================================================================
-- MIGRATION: add_upsert_rpc.sql
-- Description:
--   RPC function for handling robust upserts of invoice line items from Make.com.
--   1. Automatically parses tag_number from description.
--   2. Performs an INSERT ... ON CONFLICT (invoice_number, tag_number) DO UPDATE.
--   3. Avoids 409 Conflict errors in PostgREST by handling the logic in SQL.
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_invoice_line_item(
  p_invoice_number text,
  p_customer_name text,
  p_description text,
  p_quantity numeric,
  p_rate numeric,
  p_amount numeric,
  p_invoice_id text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_tag_number numeric;
BEGIN
  -- 1. Extract tag_number from description (same logic as trigger)
  v_tag_number := (substring(p_description FROM 'Tag[\s:#]+(\d+)'))::numeric;
  IF v_tag_number IS NULL THEN
    v_tag_number := (substring(p_description FROM '^(\d+)'))::numeric;
  END IF;

  -- 2. Perform the Upsert
  -- We use the native PostgreSQL ON CONFLICT clause
  INSERT INTO invoice_line_items (
    invoice_id,
    invoice_number,
    customer_name,
    description,
    quantity,
    rate,
    amount,
    tag_number
  ) VALUES (
    p_invoice_id,
    p_invoice_number,
    p_customer_name,
    p_description,
    p_quantity,
    p_rate,
    p_amount,
    v_tag_number
  )
  ON CONFLICT (invoice_number, tag_number) 
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    description = EXCLUDED.description,
    quantity = EXCLUDED.quantity,
    rate = EXCLUDED.rate,
    amount = EXCLUDED.amount,
    invoice_id = COALESCE(EXCLUDED.invoice_id, invoice_line_items.invoice_id);
    -- note: updated_at removed as it does not exist on this table
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE 'RPC function upsert_invoice_line_item created successfully.';
