import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def list_triggers():
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
        print("Checking for triggers on 'invoice_line_items'...")
        result = conn.execute(text("""
            SELECT tgname 
            FROM pg_trigger 
            WHERE tgrelid = 'invoice_line_items'::regclass
        """))
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f" - Found trigger: {row[0]}")
        else:
            print("No triggers found on 'invoice_line_items'.")

if __name__ == "__main__":
    list_triggers()
