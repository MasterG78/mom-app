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

engine = connect_to_supabase()

query = """
    SELECT COUNT(*) 
    FROM inventory i
    JOIN (
        SELECT DISTINCT ON (inventory_id) inventory_id, status_id 
        FROM status_changes 
        ORDER BY inventory_id, created_at DESC
    ) ls ON i.id = ls.inventory_id
    JOIN statuses s ON ls.status_id = s.id
    WHERE i.product_id IS NULL AND s.status_name = 'In Stock'
"""

with engine.connect() as conn:
    count = conn.execute(text(query)).scalar()
    print(f"In Stock tags still missing product_id: {count}")
