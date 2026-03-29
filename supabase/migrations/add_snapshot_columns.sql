-- 1. Add snapshot columns to the inventory table
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS product_name text,
ADD COLUMN IF NOT EXISTS species_name text,
ADD COLUMN IF NOT EXISTS unit_type text,
ADD COLUMN IF NOT EXISTS thickness numeric,
ADD COLUMN IF NOT EXISTS unit_inv_value numeric,
ADD COLUMN IF NOT EXISTS unit_product_value numeric;

-- 2. Backfill existing records from joined tables
UPDATE inventory i
SET 
  product_name = p.product_name,
  unit_type = p.unit_type,
  thickness = p.thickness,
  unit_inv_value = p.unit_inv_value,
  unit_product_value = p.unit_product_value,
  species_name = s.species_name
FROM products p
LEFT JOIN species s ON p.species_id = s.id
WHERE i.product_id = p.id;

-- 3. Update inventory_view to use snapshot columns
DROP VIEW IF EXISTS "inventory_view";
CREATE OR REPLACE VIEW "inventory_view" AS
SELECT
    i.id,
    i.tag,
    i.line,
    i.boardfeet,
    i.quantity,
    i.produced,
    COALESCE(i.product_name, p.product_name) as product_name,
    COALESCE(i.species_name, s.species_name) as species_name,
    pr.full_name AS tagger_name -- Assuming 'profiles' table joins on i.tagger
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id
LEFT JOIN
    species s ON i.species_id = s.id
LEFT JOIN
    profiles pr ON i.tagger = pr.id;

-- 4. Update inventory_report_view to use snapshot columns
DROP VIEW IF EXISTS "inventory_report_view";
CREATE OR REPLACE VIEW "inventory_report_view" AS
SELECT
    i.id,
    i.tag,
    (q.raw_data->>'DocNumber') AS invoice_id, -- Alias as invoice_id to match frontend
    i.line,
    i.produced,
    COALESCE(i.product_name, p.product_name) as product_name,
    i.boardfeet,
    i.quantity,
    sl.status_name AS current_status,
    i.inventory_value AS total_value,
    i.sales_value
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
    statuses sl ON latest_status.status_id = sl.id;
