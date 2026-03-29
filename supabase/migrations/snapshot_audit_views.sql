-- 1. Update inventory_view to use snapshot columns
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
    pr.full_name AS tagger_name 
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id::text = p.id::text
LEFT JOIN
    species s ON i.species_id::text = s.id::text
LEFT JOIN
    profiles pr ON i.tagger::text = pr.id::text;

-- 2. Update inventory_report_view to use snapshot columns
DROP VIEW IF EXISTS "inventory_report_view";
CREATE OR REPLACE VIEW "inventory_report_view" AS
SELECT
    i.id,
    i.tag,
    i.invoice_number,
    i.line,
    i.produced,
    COALESCE(i.product_name, p.product_name) as product_name,
    COALESCE(i.species_name, sp.species_name) as species_name,
    i.boardfeet,
    i.quantity,
    s.status_name as current_status,
    i.inventory_value as total_value,
    i.sales_value,
    i.customer_name,
    i.length,
    i.width,
    i.rows,
    i.note
FROM inventory i
LEFT JOIN products p ON i.product_id::text = p.id::text
LEFT JOIN species sp ON i.species_id::text = sp.id::text
LEFT JOIN (
    SELECT DISTINCT ON (inventory_id)
        inventory_id,
        status_id
    FROM status_changes
    ORDER BY inventory_id, created_at DESC
) latest_status ON i.id::text = latest_status.inventory_id::text
LEFT JOIN statuses s ON latest_status.status_id::text = s.id::text;
