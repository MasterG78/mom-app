import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_views():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    view_sql = """
DROP VIEW IF EXISTS "inventory_view";
CREATE OR REPLACE VIEW "inventory_view" AS
SELECT
    i.id,
    i.tag,
    i.line,
    i.boardfeet,
    i.quantity,
    i.produced,
    COALESCE(i.product_name, p.product_name) as product_name,
    COALESCE(i.species_name, s.species_name) as species_name,
    pr.full_name AS tagger_name
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id
LEFT JOIN
    species s ON i.species_id = s.id
LEFT JOIN
    profiles pr ON i.tagger = pr.id;

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
    
    print("Applying views...")
    try:
        with engine.begin() as conn:
            # We don't use .replace(':','\\:') here because there are no colons
            # Wait, there ARE colons in the subquery if SQLAlchemy thinks so, 
            # but here there aren't.
            conn.execute(text(view_sql))
        print("Views applied successfully.")
    except Exception as e:
        print(f"Error applying views: {e}")

if __name__ == "__main__":
    apply_views()
