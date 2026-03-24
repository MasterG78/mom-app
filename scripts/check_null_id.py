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
with engine.connect() as conn:
    items = conn.execute(text("SELECT id, invoice_id, invoice_number, tag_number FROM invoice_line_items WHERE invoice_number = '147626'")).fetchall()
    for item in items:
        print(item)
