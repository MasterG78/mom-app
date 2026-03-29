import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def apply_inventory_view():
    url = f"postgresql://{os.getenv('SUPABASE_DB_USER')}:{os.getenv('SUPABASE_DB_PASSWORD')}@{os.getenv('SUPABASE_DB_HOST')}:{os.getenv('SUPABASE_DB_PORT', '5432')}/{os.getenv('SUPABASE_DB_NAME')}"
    engine = create_engine(url)
    
    sql = """
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
    i.tagger as tagger_name
FROM
    inventory i
LEFT JOIN
    products p ON i.product_id = p.id
LEFT JOIN
    species s ON i.species_id = s.id;
"""
    # Removed profiles join for now as tagger initials aren't UUIDs
    # Using i.tagger directly as tagger_name (snapshot behavior)
    
    print("Applying inventory_view...")
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
        print("inventory_view applied successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    apply_inventory_view()
