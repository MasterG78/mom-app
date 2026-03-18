
import os
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

# Import the function from upload.py
from upload import reconcile_invoice_line_items, connect_to_supabase

load_dotenv()

def test_reconciliation():
    print("Starting reconciliation test...")
    engine = connect_to_supabase()
    system_user_id = '71c80b7d-61ac-47cf-9998-f482553fc54a'
    
    try:
        reconcile_invoice_line_items(engine, system_user_id)
        print("Reconciliation test completed.")
        
        # Verify specific tags that were known to be problematic
        query = """
        SELECT tag, invoice_number, sales_value, customer_name
        FROM inventory
        WHERE tag IN (50429, 49933)
        """
        with engine.connect() as conn:
            df = pd.read_sql(text(query), conn)
            print("\nVerification Results:")
            print(df.to_string())
            
            # Check for Sold status
            query_status = """
            SELECT sc.inventory_id, i.tag, s.status_name, sc.notes
            FROM status_changes sc
            JOIN statuses s ON sc.status_id = s.id
            JOIN inventory i ON sc.inventory_id = i.id
            WHERE i.tag IN (50429, 49933)
            ORDER BY sc.created_at DESC
            """
            df_status = pd.read_sql(text(query_status), conn)
            print("\nStatus Changes Verification:")
            print(df_status.to_string())
            
    except Exception as e:
        print(f"Test failed: {e}")
    finally:
        engine.dispose()

if __name__ == "__main__":
    test_reconciliation()
