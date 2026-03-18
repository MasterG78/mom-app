
import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()


def connect_to_supabase():
    from sqlalchemy.engine import URL
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    return create_engine(url)


def check_data():
    engine = connect_to_supabase()
    query = """
    SELECT 
        tag_number, 
        quote_literal(tag_number) as quoted,
        tag_number ~ '^[0-9]+$' as matches_regex,
        invoice_number
    FROM invoice_line_items 
    WHERE tag_number IS NOT NULL AND NOT (tag_number ~ '^[0-9]+$')
    ORDER BY created_at DESC
    LIMIT 100;
    """
    with engine.connect() as conn:
        df = pd.read_sql(text(query), conn)
        print("Non-numeric tags:")
        print(df.to_string())

        # Check total count of non-numeric tags
        query_count = """
        SELECT count(*) 
        FROM invoice_line_items 
        WHERE tag_number IS NOT NULL AND NOT (tag_number ~ '^[0-9]+$');
        """
        count_non_numeric = conn.execute(text(query_count)).scalar()
        print(f"\nTotal non-numeric tags: {count_non_numeric}")

        # Check for numeric tags that are NOT in inventory
        query_not_in_inv = """
        SELECT ili.tag_number, ili.invoice_number
        FROM invoice_line_items ili
        WHERE ili.tag_number ~ '^[0-9]+$'
        AND NOT EXISTS (
            SELECT 1 FROM inventory i WHERE i.tag = ili.tag_number::integer
        )
        LIMIT 10;
        """
        df_not_in_inv = pd.read_sql(text(query_not_in_inv), conn)
        print("\nNumeric tags NOT found in inventory:")
        print(df_not_in_inv.to_string())

if __name__ == "__main__":
    check_data()
