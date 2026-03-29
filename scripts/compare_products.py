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

# 1. Get unique products from Access TicketTbl
df_access = pd.read_sql("SELECT DISTINCT Product FROM TicketTbl", access_conn)
access_products = set(df_access['Product'].str.strip().dropna().unique())

# 2. Get products from Supabase
df_sb_products = pd.read_sql("SELECT product_name FROM products", sb_engine)
sb_products = set(df_sb_products['product_name'].str.strip().tolist())

# 3. Find missing
missing = access_products - sb_products

print(f"Total Unique Products in Access: {len(access_products)}")
print(f"Total Products in Supabase:      {len(sb_products)}")
print(f"Missing Product Descriptions:     {len(missing)}")

if missing:
    print("\nFirst 20 missing products:")
    for p in sorted(list(missing))[:20]:
        print(f"  {p}")

with open('missing_legacy_products_to_add.txt', 'w') as f:
    f.write("\n".join(sorted(list(missing))))
