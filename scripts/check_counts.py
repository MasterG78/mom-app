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

df_access = pd.read_sql("SELECT * FROM TicketTbl WHERE Status = 'IN' ORDER BY CDate(Produced), Val(Ticket)", access_conn)
df_statuses = pd.read_sql("SELECT id as status_id, status_name FROM statuses", sb_engine)
status_mapping = {'IN': 'In Stock', 'SO': 'Sold', 'VD': 'Void', 'MI': 'Missing', 'IS': 'Issued'}
df_access['status_name'] = df_access['Status'].map(status_mapping)
df_merged = df_access.merge(df_statuses, on='status_name', how='left')

df_merged['tag'] = df_merged['Ticket'].astype(str).str.extract(r'(\d+)').astype(float)
df_merged.dropna(subset=['tag'], inplace=True)
df_merged['tag'] = df_merged['tag'].astype('Int64')

df_inventory = pd.read_sql("SELECT id as inventory_id, tag FROM inventory", sb_engine)
df_merged = df_merged.merge(df_inventory, on='tag', how='left')
df_final = df_merged[['inventory_id', 'status_id']].copy()
df_final.dropna(inplace=True)
df_final['inventory_id'] = df_final['inventory_id'].astype(int)

latest_statuses_query = """
    SELECT DISTINCT ON (inventory_id) inventory_id, status_id as current_status_id
    FROM status_changes
    ORDER BY inventory_id, created_at DESC
"""
df_latest_statuses = pd.read_sql(latest_statuses_query, sb_engine)
df_final = df_final.merge(df_latest_statuses, on='inventory_id', how='left')

df_final = df_final.merge(df_statuses, left_on='current_status_id', right_on='status_id', how='left', suffixes=('', '_current'))

counts = df_final['status_name'].fillna('None (New Tag)').value_counts()
print("\n--- STATUS COUNTS IN SUPABASE ---")
print(counts)

