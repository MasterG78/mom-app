import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def apply_migrations():
    conn_str = os.getenv("SUPABASE_CONNECTION_STRING")
    if not conn_str:
        print("Error: SUPABASE_CONNECTION_STRING not found in environment.")
        return

    migrations = [
        "supabase/migrations/20260330160000_fix_tagger_views.sql",
        "supabase/migrations/20260330161500_restore_inventory_report_view.sql",
        "supabase/migrations/20260330171600_add_status_to_inventory_view.sql"
    ]

    try:
        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        with conn.cursor() as cur:
            for migration in migrations:
                print(f"Applying {migration}...")
                with open(migration, 'r') as f:
                    sql = f.read()
                    cur.execute(sql)
                print(f"Successfully applied {migration}")
        conn.close()
        print("All migrations applied successfully.")
    except Exception as e:
        print(f"Error applying migrations: {e}")

if __name__ == "__main__":
    apply_migrations()
