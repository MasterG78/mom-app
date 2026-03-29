-- Migration: Create Inventory Audit Trail
-- Description: Sets up a trigger-based audit log for all changes to the inventory table.

-- 1. Create the audit table
-- We use bigint for inventory_id to match the inventory table's PK.
CREATE TABLE IF NOT EXISTS inventory_audit (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id bigint REFERENCES inventory(id) ON DELETE CASCADE,
    tag integer, 
    changed_at timestamptz DEFAULT now(),
    changed_by uuid, -- Maps to auth.uid()
    action text CHECK (action IN ('UPDATE', 'DELETE')),
    old_data jsonb,
    new_data jsonb,
    changed_fields text[]
);

-- 2. Create the audit function
CREATE OR REPLACE FUNCTION process_inventory_audit()
RETURNS TRIGGER AS $$
DECLARE
    old_val jsonb;
    new_val jsonb;
    field_name text;
    diff_fields text[];
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Standard update check
        IF (OLD = NEW) THEN
            RETURN NEW;
        END IF;

        old_val := to_jsonb(OLD);
        new_val := to_jsonb(NEW);
        
        -- Analyze which fields changed
        FOR field_name IN SELECT jsonb_object_keys(old_val)
        LOOP
            IF (old_val->field_name IS DISTINCT FROM new_val->field_name) THEN
                diff_fields := array_append(diff_fields, field_name);
            END IF;
        END LOOP;

        -- Only log if actual fields changed
        IF array_length(diff_fields, 1) IS NULL THEN
            RETURN NEW;
        END IF;

        INSERT INTO inventory_audit (inventory_id, tag, action, changed_by, old_data, new_data, changed_fields)
        VALUES (OLD.id, OLD.tag, 'UPDATE', auth.uid(), old_val, new_val, diff_fields);
        
        RETURN NEW;
        
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO inventory_audit (inventory_id, tag, action, changed_by, old_data, new_data, changed_fields)
        VALUES (OLD.id, OLD.tag, 'DELETE', auth.uid(), to_jsonb(OLD), NULL, NULL);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS audit_inventory_changes ON inventory;
CREATE TRIGGER audit_inventory_changes
AFTER UPDATE OR DELETE ON inventory
FOR EACH ROW EXECUTE FUNCTION process_inventory_audit();

-- 4. Create Unified History View
DROP VIEW IF EXISTS unified_inventory_history_view;
CREATE OR REPLACE VIEW unified_inventory_history_view AS
SELECT 
    'status' as entry_type,
    sc.id::text, -- Cast ID to text for union compatibility if needed
    sc.inventory_id,
    sc.updated_at as event_at,
    pr.full_name as user_name,
    s.status_name as primary_label,
    sc.notes as secondary_label,
    NULL::text[] as changed_fields,
    NULL::jsonb as old_data,
    NULL::jsonb as new_data
FROM status_changes sc
LEFT JOIN statuses s ON sc.status_id = s.id
LEFT JOIN profiles pr ON sc.updated_by = pr.id
UNION ALL
SELECT 
    'adjustment' as entry_type,
    ia.id::text,
    ia.inventory_id,
    ia.changed_at as event_at,
    pr.full_name as user_name,
    ia.action as primary_label,
    array_to_string(ia.changed_fields, ', ') as secondary_label,
    ia.changed_fields,
    ia.old_data,
    ia.new_data
FROM inventory_audit ia
LEFT JOIN profiles pr ON ia.changed_by = pr.id;
