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
        df = pd.read_sql("SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers", conn)
        for _, r in df.iterrows():
            if r['event_object_table'] in ['inventory', 'status_changes']:
                print(f"Trigger {r['trigger_name']} ON {r['event_object_table']}: {r['event_manipulation']}")
                print(r['action_statement'])
                print("---")
except Exception as e:
    print(e)
