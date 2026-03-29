import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def verify_rpc():
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    engine = create_engine(url)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT routine_name FROM information_schema.routines WHERE routine_name = 'upsert_invoice_line_item'"))
        row = result.fetchone()
        if row:
            print(f"Success: RPC Function '{row[0]}' found.")
        else:
            print("Error: RPC Function 'upsert_invoice_line_item' not found.")

if __name__ == "__main__":
    verify_rpc()
