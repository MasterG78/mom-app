
CREATE OR REPLACE FUNCTION get_debug_info() RETURNS text AS $$
DECLARE
  ret text := '';
  r record;
  c record;
BEGIN
  -- Triggers
  FOR r IN SELECT t.tgname, p.proname, substring(p.prosrc from 1 for 200) as src
           FROM pg_trigger t
           JOIN pg_proc p ON t.tgfoid = p.oid
           WHERE t.tgrelid = 'inventory'::regclass
  LOOP
    ret := ret || 'TRIGGER: ' || r.tgname || ' FUNC: ' || r.proname || ' SRC: ' || r.src || E'\n';
  END LOOP;
  
  -- Columns
  FOR c IN SELECT column_name, data_type 
           FROM information_schema.columns 
           WHERE table_name = 'inventory' AND column_name = 'tagger'
  LOOP
    ret := ret || 'COLUMN: ' || c.column_name || ' TYPE: ' || c.data_type || E'\n';
  END LOOP;

  RETURN ret;
END;
$$ LANGUAGE plpgsql;
