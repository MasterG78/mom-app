-- =============================================================================
-- MIGRATION: add_auto_tag_parsing.sql
-- Description:
--   Automatically extracts a numeric 'tag_number' from the 'description' field
--   before a row is inserted or updated in 'invoice_line_items'.
-- 
--   This allows Make.com to send raw text without needing complex regex.
-- =============================================================================

CREATE OR REPLACE FUNCTION parse_tag_from_description()
RETURNS TRIGGER AS $$
DECLARE
    extracted_tag_text text;
BEGIN
    -- Only attempt parsing if tag_number is NOT provided or is NULL
    IF NEW.tag_number IS NULL THEN
        -- try pattern 1: Starts with a number (e.g. "51190 CROSSTIES...")
        extracted_tag_text := substring(NEW.description FROM '^(\d+)');

        -- try pattern 2: Contains "Tag: 123" or "Tag #123" or "Tag 123"
        IF extracted_tag_text IS NULL THEN
            extracted_tag_text := substring(NEW.description FROM 'Tag[\s:#]+(\d+)');
        END IF;

        -- try pattern 3: Fallback to any standalone "Tag #123" if needed (pattern 2 covers this)

        -- If a match was found, convert to numeric and store it
        IF extracted_tag_text IS NOT NULL THEN
            NEW.tag_number := extracted_tag_text::numeric;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach as a BEFORE trigger so it runs BEFORE the unique constraint check
-- and BEFORE the inventory sync trigger.
DROP TRIGGER IF EXISTS trigger_auto_parse_tag ON invoice_line_items;
CREATE TRIGGER trigger_auto_parse_tag
BEFORE INSERT OR UPDATE ON invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION parse_tag_from_description();

RAISE NOTICE 'Auto-parsing trigger added to invoice_line_items.';
