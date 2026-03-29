import os
import re
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_sql():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    migration_path = os.path.join('supabase', 'migrations', 'create_inventory_audit.sql')
    
    print(f"Reading migration from {migration_path}...")
    with open(migration_path, 'r') as f:
        sql = f.read()
    
    # Split by semicolon, but try to avoid splitting inside quotes or functions
    # Using a simpler separator for logic like plpgsql
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    
    print(f"Applying statements...")
    
    with engine.connect() as conn:
        # For PL/pgSQL blocks, splitting by ; is tricky. 
        # For this specific file, I'll use a more robust separator or just run as one block if possible.
        # But wait, create_engine and text() can handle some blocks.
        
        # Let's try running the whole script as one transaction block if possible, 
        # or at least parts.
        
        # Re-reading: 
        # 1. Create Table (ends with ;)
        # 2. Trigger Function (ends with $$ LANGUAGE plpgsql;)
        # 3. Create Trigger (ends with ;)
        # 4. Create View (ends with ;)
        
        # I'll manually split them into the 4 logical parts for reliability.
        parts = [
            # 1. Table
            """CREATE TABLE IF NOT EXISTS inventory_audit (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                inventory_id uuid REFERENCES inventory(id) ON DELETE CASCADE,
                tag integer,
                changed_at timestamptz DEFAULT now(),
                changed_by uuid REFERENCES auth.users(id),
                action text CHECK (action IN ('UPDATE', 'DELETE')),
                old_data jsonb,
                new_data jsonb,
                changed_fields text[]
            )""",
            # 2. Function
            """CREATE OR REPLACE FUNCTION process_inventory_audit()
            RETURNS TRIGGER AS $$
            DECLARE
                old_val jsonb;
                new_val jsonb;
                field_name text;
                diff_fields text[];
            BEGIN
                IF (TG_OP = 'UPDATE') THEN
                    IF (OLD = NEW) THEN
                        RETURN NEW;
                    END IF;
                    old_val := to_jsonb(OLD);
                    new_val := to_jsonb(NEW);
                    FOR field_name IN SELECT jsonb_object_keys(old_val) LOOP
                        IF (old_val->field_name IS DISTINCT FROM new_val->field_name) THEN
                            diff_fields := array_append(diff_fields, field_name);
                        END IF;
                    END LOOP;
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
            $$ LANGUAGE plpgsql SECURITY DEFINER""",
            # 3. Trigger
            "DROP TRIGGER IF EXISTS audit_inventory_changes ON inventory",
            "CREATE TRIGGER audit_inventory_changes AFTER UPDATE OR DELETE ON inventory FOR EACH ROW EXECUTE FUNCTION process_inventory_audit()",
            # 4. View
            "DROP VIEW IF EXISTS unified_inventory_history_view",
            """CREATE OR REPLACE VIEW unified_inventory_history_view AS
            SELECT 
                'status' as entry_type,
                sc.id,
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
                ia.id,
                ia.inventory_id,
                ia.changed_at as event_at,
                pr.full_name as user_name,
                ia.action as primary_label,
                array_to_string(ia.changed_fields, ', ') as secondary_label,
                ia.changed_fields,
                ia.old_data,
                ia.new_data
            FROM inventory_audit ia
            LEFT JOIN profiles pr ON ia.changed_by = pr.id"""
        ]

        with conn.begin():
            for stmt in parts:
                print(f"Executing: {stmt[:50]}...")
                conn.execute(text(stmt))
        
        print("Migration applied successfully.")

if __name__ == "__main__":
    apply_sql()
