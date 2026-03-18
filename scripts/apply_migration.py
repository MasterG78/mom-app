
import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def apply_sql():
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    engine = create_engine(url)
    
    with open('sync_invoice_line_items.sql', 'r') as f:
        sql = f.read()
        
    print("Applying sync_invoice_line_items.sql...")
    try:
        with engine.begin() as conn:
            # We need to split the SQL into statements or use a single transaction
            # Some drivers/wrappers handle multiple statements better than others.
            # For simplicity, we'll try executing the whole block.
            # If it fails, we might need to split by ';'.
            conn.execute(text(sql))
        print("SQL applied successfully.")
    except Exception as e:
        print(f"Error applying SQL: {e}")

if __name__ == "__main__":
    apply_sql()
