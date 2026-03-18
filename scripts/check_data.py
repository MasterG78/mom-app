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
    df_inv = pd.read_sql("SELECT tag, status_id FROM inventory LIMIT 5", conn)
    print("inventory snippet\\n", df_inv)
    
    df_sc = pd.read_sql("SELECT * FROM status_changes LIMIT 5", conn)
    print("status_changes snippet\\n", df_sc)
