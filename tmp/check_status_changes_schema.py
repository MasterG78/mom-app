import os
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

query = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'status_changes'"

try:
    with engine.connect() as conn:
        result = conn.execute(text(query))
        for row in result:
            print(f"{row.column_name}: {row.data_type}")
except Exception as e:
    print("Error:", e)
