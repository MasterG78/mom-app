import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def check_nulls():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    with engine.connect() as conn:
        print("Checking for null product_name in inventory...")
        count = conn.execute(text("SELECT count(*) FROM inventory WHERE product_name IS NULL")).scalar()
        print(f"Null product_name count: {count}")
        
        if count > 0:
            print("Backfill might have missed some records.")
        else:
            print("All records appear backfilled.")

if __name__ == "__main__":
    check_nulls()
