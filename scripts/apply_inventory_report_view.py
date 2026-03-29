import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_inventory_report_view():
    url = f"postgresql://{os.getenv('SUPABASE_DB_USER')}:{os.getenv('SUPABASE_DB_PASSWORD')}@{os.getenv('SUPABASE_DB_HOST')}:{os.getenv('SUPABASE_DB_PORT', '5432')}/{os.getenv('SUPABASE_DB_NAME')}"
    engine = create_engine(url)
    
    sql = """
DROP VIEW IF EXISTS "inventory_report_view";
CREATE OR REPLACE VIEW "inventory_report_view" AS
SELECT
    i.id,
    i.tag,
    (q.raw_data->>'DocNumber') AS invoice_id,
    i.line,
    i.produced,
    COALESCE(i.product_name, p.product_name) as product_name,
    i.boardfeet,
    i.quantity,
    sl.status_name AS current_status,
    i.inventory_value AS total_value,
    i.sales_value
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id
LEFT JOIN
    qbo_invoices q ON i.invoice_id = q.id
LEFT JOIN
    (
        SELECT DISTINCT ON (inventory_id) inventory_id, status_id
        FROM status_changes
        ORDER BY inventory_id, updated_at DESC
    ) latest_status ON i.id = latest_status.inventory_id
LEFT JOIN
    statuses sl ON latest_status.status_id = sl.id;
"""
    
    print("Applying inventory_report_view...")
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
        print("inventory_report_view applied successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    apply_inventory_report_view()
