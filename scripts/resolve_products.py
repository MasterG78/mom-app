import os
import pandas as pd
from sqlalchemy import create_engine
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

access_conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"
)
access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')
sb_engine = connect_to_supabase()

# 1. Get tags from Supabase where product_id is NULL
df_sb = pd.read_sql("SELECT tag FROM inventory WHERE product_id IS NULL", sb_engine)
sb_tags = set(df_sb['tag'].tolist())
print(f"Tags in Supabase with NULL product_id: {len(sb_tags)}")

# 2. Pull all Ticket/Product from Access
df_access = pd.read_sql("SELECT Ticket, Product FROM TicketTbl", access_conn)
df_access['tag_int'] = pd.to_numeric(df_access['Ticket'], errors='coerce')

# 3. Match
matched = df_access[df_access['tag_int'].isin(sb_tags)].copy()
print(f"Found matching descriptions in Access for {len(matched)} tags.")

if not matched.empty:
    # Handle mixed types for Product
    matched['Product'] = matched['Product'].fillna('').astype(str).str.strip()
    unique_products_needed = [p for p in matched['Product'].unique() if p and p.lower() not in ['nan', 'none']]
    print(f"Number of unique product descriptions to add: {len(unique_products_needed)}")
    print("\nSample of descriptions to add:")
    for p in sorted(unique_products_needed)[:20]:
        print(f"  {p}")
    
    # Save the list for reference
    matched.to_csv('missing_legacy_products_resolved.csv', index=False)
    
    with open('unique_legacy_products_to_add.txt', 'w') as f:
        f.write("\n".join(sorted(unique_products_needed)))

# Let's see some that DID NOT match
not_found_tags = sb_tags - set(df_access['tag_int'].dropna())
print(f"\nTags in Supabase but NOT found in Access TicketTbl: {len(not_found_tags)}")
if not_found_tags:
    print(f"Sample missing tags: {list(not_found_tags)[:10]}")
