
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'inventory'::regclass
    LOOP
        RAISE NOTICE 'TRIGGER FOUND: %', t_name;
    END LOOP;
END $$;
