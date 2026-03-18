import os
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv('c:\\projects\\supabase\\mom\\mom-app\\.env')

url = URL.create(
    drivername="postgresql+psycopg2",
    host=os.getenv("SUPABASE_DB_HOST"),
    port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
    database=os.getenv("SUPABASE_DB_NAME"),
    username=os.getenv("SUPABASE_DB_USER"),
    password=os.getenv("SUPABASE_DB_PASSWORD"),
)
engine = create_engine(url)

try:
    with engine.connect() as conn:
        latest_statuses = pd.read_sql("""
            SELECT DISTINCT ON (inventory_id) inventory_id, status_id
            FROM status_changes
            ORDER BY inventory_id, created_at DESC
        """, conn)
        print("Got latest statuses, count:", len(latest_statuses))
        print(latest_statuses.head())
except Exception as e:
    print("Error:", e)
