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
        q = """
            SELECT column_name, ordinal_position, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'products'
            ORDER BY ordinal_position
        """
        df = pd.read_sql(text(q), sb_engine)
        print("Column order in products table:")
        print(df)
except Exception as e:
    print(f"Error: {e}")
finally:
    sb_engine.dispose()
