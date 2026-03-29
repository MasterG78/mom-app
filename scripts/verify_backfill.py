import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def verify_backfill():
    url = f"postgresql://{os.getenv('SUPABASE_DB_USER')}:{os.getenv('SUPABASE_DB_PASSWORD')}@{os.getenv('SUPABASE_DB_HOST')}:{os.getenv('SUPABASE_DB_PORT', '5432')}/{os.getenv('SUPABASE_DB_NAME')}"
    engine = create_engine(url)
    
    with engine.connect() as conn:
        print("--- Checking Backfill Status ---")
        total_res = conn.execute(text("SELECT count(*) FROM inventory")).scalar()
        backfilled_res = conn.execute(text("SELECT count(*) FROM inventory WHERE product_name IS NOT NULL")).scalar()
        
        print(f"Total inventory records: {total_res}")
        print(f"Backfilled records: {backfilled_res}")
        
        if total_res == backfilled_res:
            print("SUCCESS: All records are backfilled.")
        else:
            print(f"WARNING: {total_res - backfilled_res} records missing snapshots.")
            
        print("\n--- Sample Snapshots ---")
        samples = conn.execute(text("SELECT tag, product_name, species_name FROM inventory WHERE product_name IS NOT NULL LIMIT 5")).fetchall()
        for s in samples:
            print(f"Tag: {s[0]} | Product: {s[1]} | Species: {s[2]}")

if __name__ == "__main__":
    verify_backfill()
