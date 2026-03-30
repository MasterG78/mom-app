import os
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv('c:\\projects\\supabase\\mom\\mom-app\\.env')

# Use local postgres if env vars are missing or for testing
db_url = "postgresql://postgres:postgres@localhost:54322/postgres"
engine = create_engine(db_url)

query = """
SELECT 
    i.tag, 
    i.product_name, 
    s.status_name as current_status
FROM inventory i
LEFT JOIN (
    SELECT DISTINCT ON (inventory_id) inventory_id, status_id
    FROM status_changes
    ORDER BY inventory_id, updated_at DESC
) latest_status ON i.id = latest_status.inventory_id
LEFT JOIN statuses s ON latest_status.status_id = s.id
WHERE i.tag = '51423'
"""

try:
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
        print(df.to_string())
except Exception as e:
    print("Error:", e)
