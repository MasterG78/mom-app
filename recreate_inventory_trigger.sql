-- Recreate the trigger to auto-create "In Stock" status on inventory insert
-- Run this in Supabase Dashboard > SQL Editor AFTER running fix_tagger_field.sql

CREATE OR REPLACE FUNCTION create_initial_inventory_status()
RETURNS TRIGGER AS $$
DECLARE
    in_stock_status_id bigint;
BEGIN
    -- Get the "In Stock" status ID
    SELECT id INTO in_stock_status_id 
    FROM statuses 
    WHERE status_name = 'In Stock' 
    LIMIT 1;
    
    -- If "In Stock" status exists, create the initial status record
    IF in_stock_status_id IS NOT NULL THEN
        INSERT INTO status_changes (inventory_id, status_id, updated_by, notes)
        VALUES (
            NEW.id,
            in_stock_status_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'Initial status'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_initial_status ON inventory;
CREATE TRIGGER trigger_create_initial_status
    AFTER INSERT ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_inventory_status();
