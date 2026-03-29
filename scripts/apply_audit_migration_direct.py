import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def apply_sql():
    try:
        host = os.getenv("SUPABASE_DB_HOST")
        port = os.getenv("SUPABASE_DB_PORT", "5432")
        user = os.getenv("SUPABASE_DB_USER", "postgres")
        password = os.getenv("SUPABASE_DB_PASSWORD")
        dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
        
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=dbname
        )
        conn.autocommit = True
        
        migration_path = os.path.join('supabase', 'migrations', 'create_inventory_audit.sql')
        with open(migration_path, 'r') as f:
            sql = f.read()
            
        with conn.cursor() as cur:
            print("Executing migration via psycopg2...")
            cur.execute(sql)
        
        conn.close()
        print("Migration applied successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    apply_sql()
