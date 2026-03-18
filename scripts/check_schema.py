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

with engine.connect() as conn:
    df = pd.read_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory'", conn)
    print("inventory columns:", df['column_name'].tolist())
    
    df2 = pd.read_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'status_changes'", conn)
    print("status_changes columns:", df2['column_name'].tolist())
