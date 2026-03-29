import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def verify():
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(url)
    
    with engine.connect() as conn:
        print("--- Checking Inventory Snapshots ---")
        res = conn.execute(text("SELECT tag, product_name, species_name, unit_type, thickness, unit_inv_value, unit_product_value FROM inventory ORDER BY produced DESC LIMIT 5")).fetchall()
        for r in res:
            print(f"Tag: {r.tag} | Product: {r.product_name} | Species: {r.species_name} | Cost: {r.unit_inv_value} | Thickness: {r.thickness}")
            
        print("\n--- Checking View Consistency ---")
        res_view = conn.execute(text("SELECT tag, product_name FROM inventory_view ORDER BY produced DESC LIMIT 5")).fetchall()
        for r in res_view:
            print(f"View Tag: {r.tag} | View Product: {r.product_name}")

if __name__ == "__main__":
    verify()
