import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def list_tables():
    conn_str = os.getenv("SUPABASE_CONNECTION_STRING")
    try:
        conn = psycopg2.connect(conn_str)
        with conn.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = cur.fetchall()
            print("Tables in 'public' schema:")
            for table in tables:
                print(f"- {table[0]}")
        conn.close()
    except Exception as e:
        print(f"Error checking tables: {e}")

if __name__ == "__main__":
    list_tables()
