import os
import pandas as pd
from sqlalchemy import create_engine, text
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

engine = connect_to_supabase()

with open('check_restore_output.txt', 'w') as f:
    # 1. Total inventory count
    df_inv_count = pd.read_sql("SELECT COUNT(*) as count FROM inventory", engine)
    f.write(f"Total inventory count: {df_inv_count['count'].iloc[0]}\n")

    # 2. Total In Stock count
    df_in_stock = pd.read_sql("""
        SELECT COUNT(*) as count
        FROM inventory i
        JOIN (
            SELECT DISTINCT ON (inventory_id) inventory_id, status_id
            FROM status_changes
            ORDER BY inventory_id, created_at DESC
        ) ls ON i.id = ls.inventory_id
        JOIN statuses s ON ls.status_id = s.id
        WHERE s.status_name = 'In Stock'
    """, engine)
    f.write(f"Total In Stock: {df_in_stock['count'].iloc[0]}\n\n")

    # 3. Last 20 records inserted into inventory (by ID)
    df_last_inv = pd.read_sql("SELECT id, tag, produced FROM inventory ORDER BY id DESC LIMIT 20", engine)
    f.write("Last 20 inventory inserts:\n")
    f.write(df_last_inv.to_string(index=False))
    f.write("\n\n")

    # 4. Check status changes for those last 20 tags
    tags = df_last_inv['tag'].tolist()
    if tags:
        tags_str = ", ".join([str(t) for t in tags])
        df_last_statuses = pd.read_sql(f"""
            SELECT sc.inventory_id, i.tag, s.status_name, sc.created_at
            FROM status_changes sc
            JOIN inventory i ON sc.inventory_id = i.id
            JOIN statuses s ON sc.status_id = s.id
            WHERE i.tag IN ({tags_str})
            ORDER BY i.tag, sc.created_at DESC
        """, engine)
        f.write("Status history for recently added tags:\n")
        f.write(df_last_statuses.to_string(index=False))

print("Output written to check_restore_output.txt")
