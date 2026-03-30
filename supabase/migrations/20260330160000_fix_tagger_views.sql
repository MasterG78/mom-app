-- Fix inventory_view to use initials directly from i.tagger
-- This migration fixes the empty Tagger field issue in the Recent Bundles section.

DROP VIEW IF EXISTS "inventory_view";
CREATE OR REPLACE VIEW "inventory_view" AS
SELECT
    i.id,
    i.tag,
    i.line,
    i.boardfeet,
    i.quantity,
    i.produced,
    p.product_name,
    i.tagger AS tagger_name -- Map initials directly to tagger_name
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id;

-- Fix inventory_report_view to include tagger initials for consistency
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
    i.tagger AS tagger_name -- Add tagger initials to the report view
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
