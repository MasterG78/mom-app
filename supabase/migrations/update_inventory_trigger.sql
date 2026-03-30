-- Migration: Add initial_status to inventory and update trigger
-- Description: Allows specifying an initial status for new inventory bundles.

-- 1. Add the column to inventory table
ALTER TABLE IF EXISTS "inventory" 
ADD COLUMN IF NOT EXISTS "initial_status" text;

-- 2. Ensure "Issued" status exists in the statuses table
-- Use a safer subquery since there is no UNIQUE constraint on status_name
INSERT INTO "statuses" (status_name, status_description)
SELECT 'Issued', 'Bundle has been issued for use'
WHERE NOT EXISTS (
    SELECT 1 FROM "statuses" WHERE "status_name" = 'Issued'
);

-- 3. Update the trigger function to use initial_status
CREATE OR REPLACE FUNCTION create_initial_inventory_status()
RETURNS TRIGGER AS $$
DECLARE
    target_status_name text;
    target_status_id bigint;
BEGIN
    -- Determine the target status name (defaulting to 'In Stock')
    target_status_name := COALESCE(NEW.initial_status, 'In Stock');

    -- Get the status ID for the target name
    SELECT id INTO target_status_id 
    FROM statuses 
    WHERE status_name = target_status_name 
    LIMIT 1;
    
    -- If the status ID was found, insert the initial status change record
    IF target_status_id IS NOT NULL THEN
        INSERT INTO status_changes (inventory_id, status_id, updated_by, notes)
        VALUES (
            NEW.id,
            target_status_id,
            COALESCE(auth.uid(), '71c80b7d-61ac-47cf-9998-f482553fc54a'::uuid),
            'Initial status set to ' || target_status_name
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
