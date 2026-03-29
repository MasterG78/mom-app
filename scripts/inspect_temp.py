import os
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def connect_to_supabase():
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    return create_engine(url)

sb_engine = connect_to_supabase()

try:
    with sb_engine.connect() as conn:
        print("Checking if temp table exists...")
        res = conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products_legacy_temp_upsert')"))
        exists = res.scalar()
        print(f"Exists: {exists}")
        
        if exists:
            print("\nContents of products_legacy_temp_upsert:")
            df = pd.read_sql("SELECT * FROM products_legacy_temp_upsert", sb_engine)
            print(df)
            print("\nRows with NULL product_name:")
            print(df[df['product_name'].isnull()])
except Exception as e:
    print(f"Error: {e}")
finally:
    sb_engine.dispose()
