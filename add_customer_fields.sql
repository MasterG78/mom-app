-- Script: add_customer_fields.sql
-- Description: Adds 'customer_name' to inventory and 'is_special_order' to products.
--              Also updates inventory_report_view to include customer_name.

-- 1. Add customer_name to inventory
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS customer_name text;

-- 2. Add is_special_order to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_special_order boolean DEFAULT false;

-- 3. Update inventory_report_view to include customer_name
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
    sl.status_name AS current_status,
    i.inventory_value AS total_value,
    i.sales_value,
    i.customer_name -- NEW FIELD
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
