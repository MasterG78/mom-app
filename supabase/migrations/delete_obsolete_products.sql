-- Deleting obsolete legacy products that were added for historical backfill.
-- Since the inventory table now has snapshot columns (product_name, etc.),
-- these product templates are no longer strictly required for historical records.

-- Note: If there are foreign key constraints, they should ideally be set to 
-- ON DELETE SET NULL or we should manually null the references first.

-- 1. Identify and nullify references to these products in the inventory table
-- to prevent foreign key violations during deletion.
UPDATE inventory
SET product_id = NULL
WHERE product_id IN (
    SELECT id FROM products 
    WHERE product_name IN (
        'IS CMat12 8x10', 'IS CMat12 8x8', 'IS CMat14 10x12', 'IS CMat14 12x12', 
        'IS CMat14 6x12', 'IS CMat14 6x8', 'IS CMat14 8x10', 'IS CMat14 8x8', 
        'IS CMat16 6x8', 'IS CMat16 8x8', 'IS CMat18 10x12', 'IS CMat18 12x12', 
        'IS CMat18 6x8', 'IS CMat18 8x10', 'IS CMat18 8x12', 'IS CMat20 12x12', 
        'IS CMat20 14x12', 'IS CMat20 16x12', 'IS CMat20 18x12', 'IS CMat24 10x12', 
        'IS CMat24 12x12', 'IS CMat24 14x12', 'IS CMat24 8x12', 'IS Ties12', 
        'Premat', 'Ties9 7x9', 'VD CMat14 6x12', 'VD Crane Mat 20''x4''x12" FN', 
        'VD Crossties9 7x9', 'VD IS CMat24 12x12', 'nan'
    )
);

-- 2. Delete the products from the products table
DELETE FROM products
WHERE product_name IN (
    'IS CMat12 8x10', 'IS CMat12 8x8', 'IS CMat14 10x12', 'IS CMat14 12x12', 
    'IS CMat14 6x12', 'IS CMat14 6x8', 'IS CMat14 8x10', 'IS CMat14 8x8', 
    'IS CMat16 6x8', 'IS CMat16 8x8', 'IS CMat18 10x12', 'IS CMat18 12x12', 
    'IS CMat18 6x8', 'IS CMat18 8x10', 'IS CMat18 8x12', 'IS CMat20 12x12', 
    'IS CMat20 14x12', 'IS CMat20 16x12', 'IS CMat20 18x12', 'IS CMat24 10x12', 
    'IS CMat24 12x12', 'IS CMat24 14x12', 'IS CMat24 8x12', 'IS Ties12', 
    'Premat', 'Ties9 7x9', 'VD CMat14 6x12', 'VD Crane Mat 20''x4''x12" FN', 
    'VD Crossties9 7x9', 'VD IS CMat24 12x12', 'nan'
);
