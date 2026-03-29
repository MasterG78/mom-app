import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def check_columns():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    # Use standard Postgres connection string
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    with engine.connect() as conn:
        print("--- Columns in 'inventory' table ---")
        query = text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'inventory' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """)
        res = conn.execute(query).fetchall()
        for r in res:
            print(f"{r.column_name}: {r.data_type}")

if __name__ == "__main__":
    check_columns()
