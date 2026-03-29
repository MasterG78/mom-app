import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def apply_rpc_migration():
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    engine = create_engine(url)
    
    # RPC Function (Now accepting text for numeric fields to handle blanks safely)
    rpc_sql = """
    CREATE OR REPLACE FUNCTION public.upsert_invoice_line_item(
      p_invoice_number text,
      p_customer_name text,
      p_description text,
      p_quantity text,
      p_rate text,
      p_amount text,
      p_invoice_id text DEFAULT NULL
    ) RETURNS void AS $$
    DECLARE
      v_tag_number numeric;
      v_quantity numeric;
      v_rate numeric;
      v_amount numeric;
    BEGIN
      -- 1. Safely convert numeric fields (handle blanks/nulls as 0)
      v_quantity := COALESCE(NULLIF(p_quantity, ''), '0')::numeric;
      v_rate     := COALESCE(NULLIF(p_rate, ''), '0')::numeric;
      v_amount   := COALESCE(NULLIF(p_amount, ''), '0')::numeric;

      -- 2. Extract tag_number from description
      v_tag_number := (substring(p_description FROM 'Tag[\\s:#]+(\\d+)'))::numeric;
      IF v_tag_number IS NULL THEN
        v_tag_number := (substring(p_description FROM '^(\\d+)'))::numeric;
      END IF;

      -- 3. Perform the Upsert
      INSERT INTO invoice_line_items (
        invoice_id,
        invoice_number,
        customer_name,
        description,
        quantity,
        rate,
        amount,
        tag_number
      ) VALUES (
        p_invoice_id,
        p_invoice_number,
        p_customer_name,
        p_description,
        v_quantity,
        v_rate,
        v_amount,
        v_tag_number
      )
      ON CONFLICT (invoice_number, tag_number) 
      DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        description = EXCLUDED.description,
        quantity = EXCLUDED.quantity,
        rate = EXCLUDED.rate,
        amount = EXCLUDED.amount,
        invoice_id = COALESCE(EXCLUDED.invoice_id, invoice_line_items.invoice_id);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
        
    print(f"Applying robust RPC fix (handling blank numeric input)...")
    try:
        with engine.begin() as conn:
            conn.execute(text(rpc_sql))
        print("RPC Function updated successfully!")
    except Exception as e:
        print(f"Error updating RPC: {e}")

if __name__ == "__main__":
    apply_rpc_migration()
