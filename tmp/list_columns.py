import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def list_columns():
    conn_str = os.getenv("SUPABASE_CONNECTION_STRING")
    try:
        conn = psycopg2.connect(conn_str)
        with conn.cursor() as cur:
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory'")
            columns = cur.fetchall()
            print("Columns in 'inventory' table:")
            for col in columns:
                print(f"- {col[0]}")
        conn.close()
    except Exception as e:
        print(f"Error checking columns: {e}")

if __name__ == "__main__":
    list_columns()
