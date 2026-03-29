import os
import traceback
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_sql():
    try:
        host = os.getenv("SUPABASE_DB_HOST")
        port = os.getenv("SUPABASE_DB_PORT", "5432")
        user = os.getenv("SUPABASE_DB_USER", "postgres")
        password = os.getenv("SUPABASE_DB_PASSWORD")
        dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
        
        url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        engine = create_engine(url)
        
        migration_path = os.path.join('supabase', 'migrations', 'create_inventory_audit.sql')
        with open(migration_path, 'r') as f:
            sql = f.read()
        
        # We split by -- to avoid breaking the PL/PGSQL block
        parts = sql.split('-- ')
        
        with engine.connect() as conn:
            # We don't use conn.begin() here if we want to run them individually 
            # or we do one big transaction. Let's do a transaction.
            with conn.begin():
                for part in parts:
                    if not part.strip(): continue
                    # Get lines starting from the first newline
                    lines = part.splitlines()
                    if not lines: continue
                    # The text after the first line (comment) is our statement
                    stmt = "\n".join(lines[1:]).strip()
                    if not stmt: continue
                    
                    print(f"Executing Part: {lines[0]}")
                    # Escape colon for SQLAlchemy
                    stmt_clean = stmt.replace(':', '\\:')
                    conn.execute(text(stmt_clean))
        
        print("Migration applied successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    apply_sql()
