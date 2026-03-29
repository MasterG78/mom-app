import os
import pandas as pd
from sqlalchemy import create_engine, text, Table, MetaData
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def connect_to_supabase():
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    return create_engine(url)

def main():
    access_conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"
    )
    access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')
    sb_engine = connect_to_supabase()

    try:
        # 1. Get 'In Stock' tags with NULL product_id
        print("Finding 'In Stock' tags in Supabase with NULL product_id...")
        query_sb_null = """
            SELECT i.tag, i.id as inventory_id
            FROM inventory i
            JOIN (
                SELECT DISTINCT ON (inventory_id) inventory_id, status_id
                FROM status_changes
                ORDER BY inventory_id, created_at DESC
            ) ls ON i.id = ls.inventory_id
            JOIN statuses s ON ls.status_id = s.id
            WHERE i.product_id IS NULL AND s.status_name = 'In Stock'
        """
        df_sb_null = pd.read_sql(query_sb_null, sb_engine)
        sb_tags = set(df_sb_null['tag'].tolist())
        print(f"Found {len(sb_tags)} 'In Stock' tags to update.")

        if not sb_tags:
            print("No 'In Stock' tags with NULL product_id found in Supabase.")
            return

        # 2. Get descriptions from Access
        print("Fetching descriptions from Access TicketTbl...")
        df_access = pd.read_sql("SELECT Ticket, Product FROM TicketTbl", access_conn)
        df_access['tag_int'] = pd.to_numeric(df_access['Ticket'], errors='coerce')
        
        matched = df_access[df_access['tag_int'].isin(sb_tags)].copy()
        matched['Product'] = matched['Product'].fillna('').astype(str).str.strip()
        matched = matched[matched['Product'] != '']
        matched = matched[~matched['Product'].str.lower().isin(['nan', 'none'])]
        
        print(f"Matched {len(matched)} tags with valid descriptions in Access.")
        
        if matched.empty:
            print("No valid matching descriptions found in Access.")
            return

        # 3. Identify unique products
        access_descriptions = {p for p in matched['Product'].unique() if p and str(p).lower() not in ['nan', 'none']}
        
        print("Checking existing Supabase products...")
        df_sb_products = pd.read_sql("SELECT id as product_id, product_name FROM products", sb_engine)
        sb_products_map = {str(name).strip().lower(): id for id, name in zip(df_sb_products['product_id'], df_sb_products['product_name'])}
        
        unique_products_to_create = sorted([desc for desc in access_descriptions if desc.lower() not in sb_products_map])
        print(f"Need to create {len(unique_products_to_create)} new products.")

        # 4. Create missing products using SQLAlchemy insert
        if unique_products_to_create:
            print("Adding missing products to Supabase...")
            metadata = MetaData()
            products_table = Table('products', metadata, autoload_with=sb_engine)
            
            insert_data = [
                {
                    'product_name': desc,
                    'menu_show': False,
                    'unit_type': 'LEGACY_IMPORT',
                    'unit_product_value': 0.0,
                    'default_length': 0.0,
                    'default_quantity': 0.0,
                    'unit_boardfeet': 0.0,
                    'unit_inv_value': 0.0
                }
                for desc in unique_products_to_create
            ]
            
            # Using engine.connect() so we can use a transaction
            with sb_engine.begin() as conn:
                for row_data in insert_data:
                    # We do them one by one to avoid bulk failures and find the problematic row if any
                    try:
                        conn.execute(products_table.insert().values(row_data))
                    except Exception as e:
                        # If it exists, just skip it (manual ON CONFLICT DO NOTHING)
                        if "duplicate key value violates unique constraint" in str(e).lower():
                            continue
                        else:
                            print(f"Error inserting product '{row_data['product_name']}': {e}")
                            raise e
            
            print(f"Successfully processed new products.")
            
            with open('missing_legacy_products_added.txt', 'a') as f:
                f.write("\n" + "\n".join(unique_products_to_create))
            
            # Refresh map
            df_sb_products = pd.read_sql("SELECT id as product_id, product_name FROM products", sb_engine)
            sb_products_map = {str(name).strip().lower(): id for id, name in zip(df_sb_products['product_id'], df_sb_products['product_name'])}

        # 5. Link tags
        print("Linking tags to product_id in Supabase...")
        update_data = []
        for _, row in matched.iterrows():
            tag = int(row['tag_int'])
            product_desc = row['Product']
            product_id = sb_products_map.get(product_desc.lower())
            if product_id:
                update_data.append({'tag': tag, 'product_id': int(product_id)})
        
        if update_data:
            df_updates = pd.DataFrame(update_data)
            temp_table = "inventory_id_update_temp"
            df_updates.to_sql(temp_table, sb_engine, if_exists='replace', index=False)
            
            q_update = f"""
                UPDATE inventory
                SET product_id = {temp_table}.product_id
                FROM {temp_table}
                WHERE inventory.tag = {temp_table}.tag AND inventory.product_id IS NULL;
            """
            with sb_engine.begin() as conn:
                res = conn.execute(text(q_update))
                print(f"Successfully linked {res.rowcount} tags.")
                conn.execute(text(f"DROP TABLE IF EXISTS {temp_table}"))
        else:
            print("No updates needed.")

    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        access_conn.dispose()
        sb_engine.dispose()

if __name__ == '__main__':
    main()
