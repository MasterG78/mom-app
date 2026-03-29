import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_sql():
    # Use standard connection string components from .env
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    migration_path = os.path.join('supabase', 'migrations', 'add_snapshot_columns.sql')
    
    print(f"Reading migration from {migration_path}...")
    with open(migration_path, 'r') as f:
        sql = f.read()
        
    print("Applying migration...")
    try:
        with engine.begin() as conn:
            # PostgreSQL can handle multiple statements in one execute call
            conn.execute(text(sql))
        print("Migration applied successfully.")
    except Exception as e:
        print(f"Error applying migration: {e}")

if __name__ == "__main__":
    apply_sql()
