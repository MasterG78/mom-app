import os
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv
from datetime import datetime

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
    if not url.host:
        raise ValueError("Supabase DB environment variables are not set.")
    return create_engine(url)

def pull_legacy_data_from_access(conn):
    # Pull ALL records with 'IN' status, regardless of date.
    query = (
        "SELECT * FROM TicketTbl "
        "WHERE Status = 'IN' "
        "ORDER BY CDate(Produced), Val(Ticket)"
    )
    df_access = pd.read_sql(query, conn)

    df_access['Product'] = df_access['Product'].astype(str).str.strip()
    df_access['Species'] = df_access['Species'].astype(str).str.strip()
    return df_access

def handle_missing_products(df_access, engine):
    """
    Finds products in the legacy Access records that are missing from Supabase.
    Inserts them into Supabase with a '(Legacy)' suffix and menu_show = False so they 
    don't pollute the new system and are easy to remove later.
    """
    # 1. Get unique products from the Access data
    access_products = df_access['Product'].unique()
    
    # 2. Get current Supabase products
    df_sb_products = pd.read_sql("SELECT product_name FROM products", engine)
    sb_products = set(df_sb_products['product_name'].tolist())
    
    # 3. Find missing ones
    missing_products = [str(p).strip() for p in access_products if pd.notna(p) and str(p).strip() and str(p).strip() not in sb_products and str(p).strip().lower() not in ['nan', 'none']]
    
    if not missing_products:
        print("No missing products found. All legacy products exist in Supabase.")
        return df_access
        
    print(f"Found {len(missing_products)} legacy products missing from Supabase.")
    
    # We will log these to a file so the user has a record
    with open('missing_legacy_products_added.txt', 'w') as f:
        f.write("Products added back for legacy tags (can be removed later):\n")
        f.write("\n".join(str(p) for p in missing_products))
    print("A record of these products has been saved to 'missing_legacy_products_added.txt'.")
    
    # Create them in the DB
    # We will name them exactly as they are in Access so the mapping works seamlessly,
    # but we'll set menu_show = False and unit_type = 'LEGACY' to flag them.
    # If the user wants to rename them with a "(Legacy)" suffix, we must also update
    # the matching of the Dataframe below. So sticking to the original name but
    # flagging them with menu_show = False and unit_type = 'LEGACY' is the cleanest hook.
    new_products_df = pd.DataFrame({
        'product_name': missing_products,
        'species_id': None, # We could try to map species, but default None is ok for legacy
        'unit_type': None, 
        'menu_show': False, # Hide from dropdowns
        'unit_product_value': 0.0,
        'default_length': 0.0,
        'default_quantity': 0.0,
        'unit_boardfeet': 0.0,
        'unit_inv_value': 0.0
    })
    
    new_products_df.to_sql('products_temp_legacy', engine, if_exists='replace', index=False)
    
    cols = new_products_df.columns.tolist()
    insert_cols_sql = ", ".join([f'"{c}"' for c in cols])
    
    select_cols = []
    for c in cols:
        if c == 'species_id':
            select_cols.append(f'CAST("{c}" AS bigint)')
        elif c == 'unit_type':
            select_cols.append(f'CAST("{c}" AS text)')
        else:
            select_cols.append(f'"{c}"')
    select_cols_sql = ", ".join(select_cols)
    
    # Upsert they might have existed and were softly deleted
    upsert_query = f"""
    INSERT INTO products ({insert_cols_sql})
    SELECT {select_cols_sql} FROM products_temp_legacy
    ON CONFLICT (product_name) DO NOTHING;
    """
    
    with engine.begin() as conn:
        conn.execute(text(upsert_query))
        conn.execute(text("DROP TABLE IF EXISTS products_temp_legacy;"))
        
    print(f"Successfully added {len(missing_products)} missing products (flagged with menu_show=False).")
    
    return df_access
    
def pull_lookup_data_from_supabase(engine):
    df_products = pd.read_sql("SELECT id as product_id, product_name FROM products", engine)
    df_species = pd.read_sql("SELECT id as species_id, species_name FROM species", engine)
    return df_products, df_species

def map_and_transform_data(df_access, df_products, df_species):
    df_mapped = df_access.merge(
        df_products,
        left_on='Product',
        right_on='product_name',
        how='left'
    )
    df_mapped = df_mapped.merge(
        df_species,
        left_on='Species',
        right_on='species_name',
        how='left'
    )

    column_mapping = {
        'Produced': 'produced',
        'Ticket': 'tag',
        'Line': 'line',
        'BoardFt': 'boardfeet',
        'Qty': 'quantity',
        'BundleVal': 'inventory_value',
        'Note': 'note',
        'Length': 'length',
        'Width': 'width',
        'Rows': 'rows',
        'Weight': 'weight'
    }
    df_mapped = df_mapped.rename(columns=column_mapping)

    df_mapped['tag'] = df_mapped['tag'].astype(str).str.extract(r'(\d+)').astype(float)
    df_mapped.dropna(subset=['tag'], inplace=True)
    df_mapped['tag'] = df_mapped['tag'].astype('Int64')

    df_mapped['note'] = df_mapped['note'].fillna('')
    df_mapped['tagger'] = df_mapped['Tagged'].fillna('')
    
    final_cols = [
        'produced', 'tag', 'product_id', 'species_id', 'line',
        'boardfeet', 'quantity', 'inventory_value', 'note',
        'tagger', 'length', 'width', 'rows', 'weight'
    ]
    for col in final_cols:
        if col not in df_mapped:
            df_mapped[col] = None

    return df_mapped[final_cols]

def upload_to_supabase(df, engine):
    if df.empty:
        print("No data to upload.")
        return

    temp_table_name = "inventory_legacy_temp_upsert"

    try:
        df.to_sql(temp_table_name, engine, if_exists='replace', index=False)
        cols = df.columns.tolist()
        insert_cols_sql = ", ".join([f'"{c}"' for c in cols])
        select_cols_sql = ", ".join([f'"{c}"' for c in cols])
        update_sql = ", ".join([f'"{c}" = EXCLUDED."{c}"' for c in cols if c != 'tag'])

        upsert_query = f"""
        INSERT INTO inventory ({insert_cols_sql})
        SELECT {select_cols_sql} FROM {temp_table_name}
        ON CONFLICT (tag) DO UPDATE SET
            {update_sql};
        """
        with engine.begin() as conn:
            user_id = '71c80b7d-61ac-47cf-9998-f482553fc54a'
            jwt_payload = f'{{"sub": "{user_id}"}}'
            conn.execute(text(f"SET request.jwt.claims = '{jwt_payload}'"))

            result = conn.execute(text(upsert_query))
            print(f"Legacy inventory upload complete. {result.rowcount} records were inserted/updated.")

    except Exception as e:
        print(f"An error occurred during legacy inventory upsert: {e}")
    finally:
        with engine.begin() as conn:
            conn.execute(text(f"DROP TABLE IF EXISTS {temp_table_name};"))

def add_status_changes(df, engine):
    if df.empty:
        print("No status changes to upload.")
        return

    try:
        df_statuses = pd.read_sql("SELECT id as status_id, status_name FROM statuses", engine)
        df_inventory = pd.read_sql("SELECT id as inventory_id, tag FROM inventory", engine)

        status_mapping = {
            'IN': 'In Stock',
            'SO': 'Sold',
            'VD': 'Void',
            'MI': 'Missing',
            'IS': 'Issued'
        }
        df['status_name'] = df['Status'].map(status_mapping)

        df_merged = df.merge(df_statuses, on='status_name', how='left')
        df_merged['tag'] = df_merged['Ticket'].astype(str).str.extract(r'(\d+)').astype(float)
        df_merged.dropna(subset=['tag'], inplace=True)
        df_merged['tag'] = df_merged['tag'].astype('Int64')
        df_merged = df_merged.merge(df_inventory, on='tag', how='left')

        df_final = df_merged[['inventory_id', 'status_id']].copy()
        df_final.dropna(inplace=True)
        df_final['inventory_id'] = df_final['inventory_id'].astype(int)
        df_final['status_id'] = df_final['status_id'].astype(int)

        latest_statuses_query = """
            SELECT DISTINCT ON (inventory_id) inventory_id, status_id as current_status_id
            FROM status_changes
            ORDER BY inventory_id, created_at DESC
        """
        df_latest_statuses = pd.read_sql(latest_statuses_query, engine)

        def get_status_id(name):
            match = df_statuses.loc[df_statuses['status_name'] == name, 'status_id']
            return int(match.iloc[0]) if not match.empty else None

        sold_id     = get_status_id('Sold')
        in_stock_id = get_status_id('In Stock')

        df_final = df_final.merge(df_latest_statuses, on='inventory_id', how='left')

        # Rule 1
        df_final = df_final[df_final['status_id'] != df_final['current_status_id']]

        # Rule 2
        if sold_id is not None and in_stock_id is not None:
            downgrade_mask = (
                (df_final['current_status_id'] == sold_id) &
                (df_final['status_id'] == in_stock_id)
            )
            df_final = df_final[~downgrade_mask]

        df_final = df_final.drop(columns=['current_status_id'])

        if df_final.empty:
            print("No new status changes to upload after deduplication.")
            return

        df_final['updated_by'] = '71c80b7d-61ac-47cf-9998-f482553fc54a'
        df_final['created_at'] = datetime.now()

        with engine.begin() as conn:
            df_final.to_sql('status_changes', conn, if_exists='append', index=False)
            print(f"Added {len(df_final)} status changes for legacy items.")

    except Exception as e:
        print(f"An error occurred during legacy status changes update: {e}")

def main():
    access_conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"
    )
    access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')
    supabase_engine = connect_to_supabase()

    if access_conn is None:
        print("MS Access connection is not configured. Aborting.")
        return

    try:
        print("Pulling all legacy 'IN' inventory from Access...")
        df_access = pull_legacy_data_from_access(access_conn)
        print(f"Pulled {len(df_access)} legacy 'IN' records from Access.")

        # Address missing products
        df_access = handle_missing_products(df_access, supabase_engine)

        df_products, df_species = pull_lookup_data_from_supabase(supabase_engine)
        
        df_final = map_and_transform_data(df_access, df_products, df_species)
        print(f"Processing {len(df_final)} legacy tags for upload.")

        upload_to_supabase(df_final, supabase_engine)
        
        add_status_changes(df_access, supabase_engine)

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if hasattr(access_conn, 'dispose'):
            access_conn.dispose()
        supabase_engine.dispose()

if __name__ == "__main__":
    main()
