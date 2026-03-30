-- Restore inventory_report_view after regression
-- Uses i.invoice_number directly (no join to qbo_invoices needed)

DROP VIEW IF EXISTS "inventory_report_view" CASCADE;
CREATE OR REPLACE VIEW "inventory_report_view" AS
SELECT
    i.id,
    i.tag,
    i.invoice_number,
    i.line,
    i.produced,
    COALESCE(i.product_name, p.product_name) AS product_name,
    i.boardfeet,
    i.quantity,
    s.status_name AS current_status,
    i.inventory_value AS total_value,
    i.sales_value,
    i.customer_name,
    i.tagger AS tagger_name,
    i.length,
    i.width,
    i.rows,
    i.note,
    COALESCE(i.species_name, sp.species_name) AS species_name
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id
LEFT JOIN species sp ON i.species_id = sp.id
LEFT JOIN (
    SELECT DISTINCT ON (inventory_id)
        inventory_id,
        status_id
    FROM status_changes
    ORDER BY inventory_id, created_at DESC
) latest_status ON i.id = latest_status.inventory_id
LEFT JOIN statuses s ON latest_status.status_id = s.id;
