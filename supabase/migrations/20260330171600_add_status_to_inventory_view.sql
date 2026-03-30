-- Update inventory_view to include current_status and all necessary snapshot columns
-- This enables the Tag Lookup tool to display the actual status and manage adjustments correctly.

DROP VIEW IF EXISTS "inventory_view";
CREATE OR REPLACE VIEW "inventory_view" AS
SELECT
    i.id,
    i.tag,
    i.line,
    i.boardfeet,
    i.quantity,
    i.produced,
    i.product_name,
    i.species_name,
    i.unit_type,
    i.thickness,
    i.unit_inv_value,
    i.unit_product_value,
    i.inventory_value,
    i.sales_value,
    i.customer_name,
    i.note,
    i.tagger AS tagger_name,
    i.product_id,
    i.species_id,
    sl.status_name AS current_status,
    latest_status.status_id AS status_id
FROM
    inventory i
LEFT JOIN
    (
        SELECT DISTINCT ON (inventory_id) inventory_id, status_id
        FROM status_changes
        ORDER BY inventory_id, created_at DESC
    ) latest_status ON i.id = latest_status.inventory_id
LEFT JOIN
    statuses sl ON latest_status.status_id = sl.id;
