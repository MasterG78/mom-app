-- Update Views to use new snake_case table names
-- NOTE: These definitions are inferred from the columns listed in DB_SCHEMA.md. 
-- Please verify the logic matches your original views before running.

-- 1. inventory_view
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
    pr.full_name AS tagger_name -- Assuming 'profiles' table joins on i.tagger
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id
LEFT JOIN
    profiles pr ON i.tagger = pr.id;

-- 2. status_history_view
DROP VIEW IF EXISTS "status_history_view";
CREATE OR REPLACE VIEW "status_history_view" AS
SELECT
    sc.id,
    sc.inventory_id,
    sc.updated_at,
    sc.notes,
    sl.status_name,
    sl.status_description,
    pr.full_name AS updater_name
FROM
    status_changes sc
JOIN
    status_list sl ON sc.status_id = sl.id
LEFT JOIN
    profiles pr ON sc.updated_by = pr.id;

-- 3. inventory_report_view
DROP VIEW IF EXISTS "inventory_report_view";
CREATE OR REPLACE VIEW "inventory_report_view" AS
SELECT
    i.id,
    i.tag,
    (q.raw_data->>'DocNumber') AS invoice_id, -- Alias as invoice_id to match frontend
    i.line,
    i.produced,
    p.product_name,
    i.boardfeet,
    i.quantity,
    sl.status_name AS current_status,
    i.inventory_value AS total_value
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
    status_list sl ON latest_status.status_id = sl.id;
