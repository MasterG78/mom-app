import os
import re
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_sql():
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
    
    # Split by semicolon, but try to avoid splitting inside quotes or functions
    # For this specific file, splitting by ';' at the end of lines is sufficient
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    
    print(f"Applying {len(statements)} statements...")
    
    with engine.connect() as conn:
        for i, stmt in enumerate(statements, 1):
            print(f"Executing statement {i}/{len(statements)}...")
            try:
                # Use a transaction for each statement
                with conn.begin():
                    # Escape ':' to avoid SQLAlchemy parameter issues
                    executed_stmt = stmt.replace(':', '\\:')
                    conn.execute(text(executed_stmt))
                print(f"Statement {i} applied successfully.")
            except Exception as e:
                print(f"Error applying statement {i}: {e}")
                print(f"Statement content: {stmt[:100]}...")
                # Continue or exit? For schema changes, it's often better to stop.
                break

if __name__ == "__main__":
    apply_sql()
