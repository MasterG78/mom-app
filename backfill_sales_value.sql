-- Script: backfill_sales_value.sql
-- Description: Updates existing inventory records that have 0 or NULL sales_value.
--              Calculates the predicted price based on the current product unit value.

UPDATE inventory i
SET sales_value = (
    CASE 
        WHEN p.unit_type = 'Bd Ft' THEN COALESCE(i.boardfeet, 0) * COALESCE(p.unit_product_value, 0)
        ELSE COALESCE(i.quantity, 0) * COALESCE(p.unit_product_value, 0)
    END
)
FROM products p
WHERE i.product_id = p.id
AND (i.sales_value IS NULL OR i.sales_value = 0)
AND i.invoice_id IS NULL; -- Only update if not already linked to an invoice (though logic implies these are 'predicted' prices)
