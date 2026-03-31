-- Fix upsert_invoice_line_item to omit tag_number which is a GENERATED always column

CREATE OR REPLACE FUNCTION public.upsert_invoice_line_item(
  p_invoice_number text,
  p_customer_name text,
  p_description text,
  p_quantity text,
  p_rate text,
  p_amount text,
  p_invoice_id text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_quantity numeric;
  v_rate numeric;
  v_amount numeric;
BEGIN
  -- 1. Safely convert numeric fields (handle blanks/nulls as 0)
  v_quantity := COALESCE(NULLIF(p_quantity, ''), '0')::numeric;
  v_rate     := COALESCE(NULLIF(p_rate, ''), '0')::numeric;
  v_amount   := COALESCE(NULLIF(p_amount, ''), '0')::numeric;

  -- 2. Perform the Upsert without explicitly inserting tag_number
  -- (tag_number is a generated column and will be populated by PostgreSQL automatically)
  INSERT INTO invoice_line_items (
    invoice_id,
    invoice_number,
    customer_name,
    description,
    quantity,
    rate,
    amount
  ) VALUES (
    p_invoice_id,
    p_invoice_number,
    p_customer_name,
    p_description,
    v_quantity,
    v_rate,
    v_amount
  )
  ON CONFLICT (invoice_number, tag_number) 
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    description = EXCLUDED.description,
    quantity = EXCLUDED.quantity,
    rate = EXCLUDED.rate,
    amount = EXCLUDED.amount,
    invoice_id = COALESCE(EXCLUDED.invoice_id, invoice_line_items.invoice_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
