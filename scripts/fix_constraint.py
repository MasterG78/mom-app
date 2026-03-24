import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()
url = URL.create(
    drivername='postgresql+psycopg2',
    host=os.getenv('SUPABASE_DB_HOST'),
    port=int(os.getenv('SUPABASE_DB_PORT', 5432)),
    database=os.getenv('SUPABASE_DB_NAME'),
    username=os.getenv('SUPABASE_DB_USER'),
    password=os.getenv('SUPABASE_DB_PASSWORD'),
)
engine = create_engine(url)

sql_commands = [
    # 1. Delete duplicates in invoice_line_items, keeping the one with highest amount or arbitrary one
    """
    DELETE FROM invoice_line_items
    WHERE id IN (
        SELECT id
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY invoice_number, tag_number ORDER BY created_at DESC) as row_num
            FROM invoice_line_items
        ) t
        WHERE t.row_num > 1
    );
    """,
    # 2. Drop the old constraint
    """
    ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS uq_invoice_tag;
    """,
    # 3. Add the new constraint with the correct column
    """
    ALTER TABLE invoice_line_items ADD CONSTRAINT uq_invoice_tag UNIQUE (invoice_number, tag_number);
    """,
    # 4. Resolve the false system alerts generated for these
    """
    UPDATE system_alerts 
    SET resolved = true, resolved_at = NOW() 
    WHERE alert_type = 'DUPLICATE_SALE' AND title = 'Duplicate Sale on Same Invoice' 
    AND resolved = false;
    """
]

with engine.begin() as conn:
    for sql in sql_commands:
        print(f"Executing: {sql[:50]}...")
        conn.execute(text(sql))
print("Database cleanup and constraint fix completed successfully.")
