import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def verify_views():
    conn_str = os.getenv("SUPABASE_CONNECTION_STRING")
    try:
        conn = psycopg2.connect(conn_str)
        with conn.cursor() as cur:
            print("Verifying inventory_view...")
            cur.execute("SELECT tag, tagger_name, current_status FROM inventory_view LIMIT 1")
            row = cur.fetchone()
            if row:
                print(f"Success: inventory_view has tag={row[0]}, tagger_name={row[1]}, current_status={row[2]}")
            else:
                print("Warning: inventory_view is empty.")

            print("\nVerifying inventory_report_view...")
            cur.execute("SELECT tag, tagger_name, current_status, invoice_id FROM inventory_report_view LIMIT 1")
            row = cur.fetchone()
            if row:
                print(f"Success: inventory_report_view has tag={row[0]}, tagger_name={row[1]}, current_status={row[2]}, invoice_id={row[3]}")
            else:
                print("Warning: inventory_report_view is empty.")
        conn.close()
    except Exception as e:
        print(f"Error verifying views: {e}")

if __name__ == "__main__":
    verify_views()
