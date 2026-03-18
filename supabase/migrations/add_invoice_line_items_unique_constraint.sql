-- =============================================================================
-- MIGRATION: add_invoice_line_items_unique_constraint.sql
-- Description:
--   Add a unique constraint on (invoice_id, tag_number) to invoice_line_items
--   so that the Make.com daily sync can upsert with `resolution=merge-duplicates`
--   without creating duplicate rows.
--
-- Safe to run multiple times (uses IF NOT EXISTS guard).
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_invoice_tag'
          AND conrelid = 'invoice_line_items'::regclass
    ) THEN
        ALTER TABLE invoice_line_items
        ADD CONSTRAINT uq_invoice_tag UNIQUE (invoice_id, tag_number);

        RAISE NOTICE 'Constraint uq_invoice_tag added successfully.';
    ELSE
        RAISE NOTICE 'Constraint uq_invoice_tag already exists — skipping.';
    END IF;
END $$;
