import os
import pandas as pd
from sqlalchemy import create_engine
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

# Check for some sample names from Access list
search_terms = ['CMat', 'Crossties', 'Gum', 'Hick', 'WO']
for term in search_terms:
    query = f"SELECT product_name FROM products WHERE product_name ILIKE '%%{term}%%' LIMIT 5"
    df = pd.read_sql(query, sb_engine)
    print(f"\nProducts in Supabase containing '{term}':")
    print(df['product_name'].tolist())
