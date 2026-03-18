-- Run this in Supabase Dashboard > SQL Editor
-- This will fix the tagger field to be text instead of UUID

-- Step 1: Drop the dependent view
DROP VIEW IF EXISTS inventory_view CASCADE;

-- Step 2: Drop the foreign key constraint
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS "Inventory_tagger_fkey";

-- Step 3: Disable any triggers on inventory table to prevent them from firing during ALTER
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'inventory'::regclass AND NOT tgisinternal
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON inventory';
    END LOOP;
END $$;

-- Step 4: Alter the tagger column to text
ALTER TABLE inventory 
  ALTER COLUMN tagger DROP DEFAULT,
  ALTER COLUMN tagger TYPE text USING tagger::text;

-- Step 3: Recreate the view
CREATE OR REPLACE VIEW inventory_view AS
SELECT
    i.id,
    i.tag,
    i.line,
    i.boardfeet,
    i.quantity,
    i.produced,
    p.product_name,
    i.tagger AS tagger_name
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id;

-- Step 4: Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory' AND column_name = 'tagger';
