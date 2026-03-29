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

# Get all IN tags from Access
df_access = pd.read_sql("SELECT Val(Ticket) as tag FROM TicketTbl WHERE Status = 'IN'", access_conn)
df_access['tag'] = pd.to_numeric(df_access['tag'], errors='coerce').dropna().astype('Int64')
access_in_tags = set(df_access['tag'].dropna())

# Get all In Stock tags from Supabase
df_sb = pd.read_sql("""
    SELECT i.tag, i.produced, p.product_name, i.line
    FROM inventory i
    JOIN (
        SELECT DISTINCT ON (inventory_id) inventory_id, status_id
        FROM status_changes
        ORDER BY inventory_id, created_at DESC
    ) ls ON i.id = ls.inventory_id
    JOIN statuses s ON ls.status_id = s.id
    LEFT JOIN products p ON i.product_id = p.id
    WHERE s.status_name = 'In Stock'
    ORDER BY i.tag
""", sb_engine)
sb_instock_tags = set(df_sb['tag'])

# Find extras: In Stock in Supabase but NOT IN in Access
extra_tags = sb_instock_tags - access_in_tags
df_extras = df_sb[df_sb['tag'].isin(extra_tags)].sort_values('tag')

print(f"Access IN count:        {len(access_in_tags)}")
print(f"Supabase In Stock count: {len(sb_instock_tags)}")
print(f"Extra in Supabase:       {len(extra_tags)}")

df_extras.to_csv('extra_supabase_instock.csv', index=False)
print(f"\nSaved {len(df_extras)} extra records to extra_supabase_instock.csv")
