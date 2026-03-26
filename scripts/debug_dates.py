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

sb_engine = connect_to_supabase()

with open('debug_dates_output2.txt', 'w') as f:
    # How many records have null produced?
    df_null = pd.read_sql("SELECT COUNT(*) as cnt FROM inventory WHERE produced IS NULL", sb_engine)
    f.write(f"Records with NULL produced: {df_null['cnt'].iloc[0]}\n\n")

    # Status breakdown for In Stock records
    df_instock = pd.read_sql("""
        SELECT 
            CASE 
                WHEN i.produced >= NOW() - INTERVAL '30 days' THEN 'last_30_days'
                WHEN i.produced >= NOW() - INTERVAL '90 days' THEN '31_to_90_days'
                WHEN i.produced >= NOW() - INTERVAL '365 days' THEN '91_to_365_days'
                ELSE 'older_than_1_year'
            END as age_bucket,
            COUNT(*) as cnt
        FROM inventory i
        JOIN (
            SELECT DISTINCT ON (inventory_id) inventory_id, status_id 
            FROM status_changes 
            ORDER BY inventory_id, created_at DESC
        ) ls ON i.id = ls.inventory_id
        JOIN statuses s ON ls.status_id = s.id
        WHERE s.status_name = 'In Stock'
        GROUP BY age_bucket
        ORDER BY age_bucket
    """, sb_engine)
    f.write("In Stock records by age bucket:\n")
    f.write(df_instock.to_string(index=False))
    f.write("\n\n")

    # Total In Stock count
    df_total_instock = pd.read_sql("""
        SELECT COUNT(*) as cnt
        FROM inventory i
        JOIN (
            SELECT DISTINCT ON (inventory_id) inventory_id, status_id 
            FROM status_changes 
            ORDER BY inventory_id, created_at DESC
        ) ls ON i.id = ls.inventory_id
        JOIN statuses s ON ls.status_id = s.id
        WHERE s.status_name = 'In Stock'
    """, sb_engine)
    f.write(f"Total In Stock: {df_total_instock['cnt'].iloc[0]}\n\n")
    
    # Check the report view for In Stock + count
    df_view_instock = pd.read_sql("""
        SELECT COUNT(*) as cnt 
        FROM inventory_report_view 
        WHERE current_status = 'In Stock'
    """, sb_engine)
    f.write(f"Report View In Stock: {df_view_instock['cnt'].iloc[0]}\n\n")

    # Specifically check tags from Access that should be In Stock
    # What's the oldest In Stock tag?
    df_oldest_instock = pd.read_sql("""
        SELECT tag, produced, product_name, current_status
        FROM inventory_report_view
        WHERE current_status = 'In Stock'
        ORDER BY produced ASC
        LIMIT 20
    """, sb_engine)
    f.write("20 OLDEST 'In Stock' records in report view:\n")
    for _, row in df_oldest_instock.iterrows():
        f.write(f"  Tag: {row['tag']}, Produced: {row['produced']}, Product: {row['product_name']}\n")

print("Output written to debug_dates_output2.txt")
