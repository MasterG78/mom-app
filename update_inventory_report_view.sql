-- Drop the existing view
DROP VIEW IF EXISTS inventory_report_view;

-- Re-create the view with additional fields
CREATE OR REPLACE VIEW inventory_report_view AS
SELECT
    i.id,
    i.tag,
    i.invoice_id::text,  -- Cast to text if needed, or keep as integer depending on preference
    i.line,
    i.produced,
    p.product_name,
    i.boardfeet,
    i.quantity,
    s.status_name as current_status,
    i.inventory_value as total_value,
    i.sales_value,
    i.customer_name,
    -- NEW FIELDS FOR TAG
    i.length,
    i.width,
    i.rows,
    i.note,
    sp.species_name
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
LEFT JOIN status_list s ON latest_status.status_id = s.id;
