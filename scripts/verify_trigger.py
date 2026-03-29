import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def verify_trigger():
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
        result = conn.execute(text("SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_auto_parse_tag'"))
        row = result.fetchone()
        if row:
            print(f"Success: Trigger '{row[0]}' found.")
        else:
            print("Error: Trigger 'trigger_auto_parse_tag' not found.")

if __name__ == "__main__":
    verify_trigger()
