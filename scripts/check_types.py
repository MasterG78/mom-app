import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def check():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, database=dbname)
    cur = conn.cursor()
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'id'")
    print(f"Inventory ID: {cur.fetchone()}")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'status_changes' AND column_name = 'inventory_id'")
    print(f"StatusChanges InventoryID: {cur.fetchone()}")
    conn.close()

if __name__ == "__main__":
    check()
