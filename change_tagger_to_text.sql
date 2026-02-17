-- 1. Drop the dependent view
DROP VIEW IF EXISTS "inventory_view";

-- 2. Alter the inventory table
ALTER TABLE "inventory" 
  ALTER COLUMN "tagger" DROP DEFAULT,
  ALTER COLUMN "tagger" TYPE text USING "tagger"::text;

-- 3. Recreate the view without joining profiles for tagger
CREATE OR REPLACE VIEW "inventory_view" AS
SELECT
    i.id,
    i.tag,
    i.line,
    i.boardfeet,
    i.quantity,
    i.produced,
    p.product_name,
    i.tagger AS tagger_name -- Now directly selecting the text field
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id;
