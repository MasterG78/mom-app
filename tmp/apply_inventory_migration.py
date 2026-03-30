import os
import sqlalchemy
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv('c:\\projects\\supabase\\mom\\mom-app\\.env')

db_url = URL.create(
    drivername="postgresql+psycopg2",
    host=os.getenv("SUPABASE_DB_HOST"),
    port=int(os.getenv("SUPABASE_DB_PORT", 6543)),
    database=os.getenv("SUPABASE_DB_NAME"),
    username=os.getenv("SUPABASE_DB_USER"),
    password=os.getenv("SUPABASE_DB_PASSWORD"),
)

engine = create_engine(db_url)

migration_file = 'supabase/migrations/20260330171600_add_status_to_inventory_view.sql'

with open(migration_file, 'r') as f:
    sql = f.read()

print(f"Applying {migration_file}...")
try:
    with engine.begin() as conn:
        conn.execute(text(sql))
    print("Migration applied successfully.")
except Exception as e:
    print(f"Error applying migration: {e}")
