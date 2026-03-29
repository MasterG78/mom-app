import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def verify():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    with engine.connect() as conn:
        print("--- Columns in inventory ---")
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory' AND table_schema = 'public'")).fetchall()
        for r in res:
            print(r[0])
            
        print("\n--- Testing Data Snapshot ---")
        # Check if there is any data in the new columns
        res_data = conn.execute(text("SELECT tag, product_name, species_name FROM inventory WHERE product_name IS NOT NULL LIMIT 5")).fetchall()
        for r in res_data:
            print(f"Tag: {r[0]} | Snapshot Product: {r[1]} | Snapshot Species: {r[2]}")

if __name__ == "__main__":
    verify()
