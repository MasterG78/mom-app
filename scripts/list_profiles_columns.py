import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def list_cols():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    with engine.connect() as conn:
        print("--- Columns in 'profiles' table ---")
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public'")).fetchall()
        for r in res:
            print(r[0])

if __name__ == "__main__":
    list_cols()
