
DO $$
DECLARE
    dt text;
BEGIN
    SELECT data_type INTO dt FROM information_schema.columns 
    WHERE table_name = 'inventory' AND column_name = 'tagger';
    
    RAISE NOTICE 'COLUMN TYPE: %', dt;
END $$;
