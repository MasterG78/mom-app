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
print(f"Total initial records: {len(df_access)}")

df_statuses = pd.read_sql("SELECT id as status_id, status_name FROM statuses", sb_engine)
status_mapping = {'IN': 'In Stock', 'SO': 'Sold', 'VD': 'Void', 'MI': 'Missing', 'IS': 'Issued'}
df_access['status_name'] = df_access['Status'].map(status_mapping)

df_merged = df_access.merge(df_statuses, on='status_name', how='left')
print(f"Records with valid statuses: {df_merged['status_id'].notna().sum()}")
if df_merged['status_id'].isna().sum() > 0:
    print(f"Sample invalid statuses: {df_access[df_merged['status_id'].isna()]['Status'].unique()}")

df_merged['tag'] = df_merged['Ticket'].astype(str).str.extract(r'(\d+)').astype(float)
df_merged.dropna(subset=['tag'], inplace=True)
df_merged['tag'] = df_merged['tag'].astype('Int64')

df_inventory = pd.read_sql("SELECT id as inventory_id, tag FROM inventory", sb_engine)
df_merged = df_merged.merge(df_inventory, on='tag', how='left')
print(f"Records matched with inventory tags: {df_merged['inventory_id'].notna().sum()}")
if df_merged['inventory_id'].isna().sum() > 0:
    print("Some tags were not matched to inventory_id.")

df_final = df_merged[['inventory_id', 'status_id']].copy()
df_final.dropna(inplace=True)
df_final['inventory_id'] = df_final['inventory_id'].astype(int)
df_final['status_id'] = df_final['status_id'].astype(int)

latest_statuses_query = """
    SELECT DISTINCT ON (inventory_id) inventory_id, status_id as current_status_id
    FROM status_changes
    ORDER BY inventory_id, created_at DESC
"""
df_latest_statuses = pd.read_sql(latest_statuses_query, sb_engine)

df_final = df_final.merge(df_latest_statuses, on='inventory_id', how='left')
print(f"Before rule 1 (total rows with status): {len(df_final)}")
# Rule 1
df_final = df_final[df_final['status_id'] != df_final['current_status_id']]
print(f"After rule 1 (not equal current status): {len(df_final)}")

def get_status_id(name):
    match = df_statuses.loc[df_statuses['status_name'] == name, 'status_id']
    return int(match.iloc[0]) if not match.empty else None

sold_id     = get_status_id('Sold')
in_stock_id = get_status_id('In Stock')

if sold_id is not None and in_stock_id is not None:
    downgrade_mask = (
        (df_final['current_status_id'] == sold_id) &
        (df_final['status_id'] == in_stock_id)
    )
    df_downgraded = df_final[downgrade_mask]
    
    # Need to get 'tag' back
    mismatched_records = df_merged[df_merged['inventory_id'].isin(df_downgraded['inventory_id'])]
    mismatched_records = mismatched_records[['Produced', 'Ticket', 'tag', 'Product', 'Line']]
    mismatched_records['Supabase_Status'] = 'Sold'
    mismatched_records['Access_Status'] = 'IN'
    
    mismatched_records.to_csv('mismatched_sold_tags.csv', index=False)
    print(f"Saved {len(mismatched_records)} mismatched records to mismatched_sold_tags.csv")
    
    df_final = df_final[~downgrade_mask]
print(f"After rule 2 (downgrade prevention): {len(df_final)}")

