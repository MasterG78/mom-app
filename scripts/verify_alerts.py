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
    with open('output-verify.txt', 'w', encoding='utf-8') as f:
        f.write("--- RECENT SYSTEM ALERTS ---\n")
        alerts = conn.execute(text("SELECT id, alert_type, title, message, reference_id, created_at FROM system_alerts WHERE alert_type = 'DUPLICATE_SALE' ORDER BY created_at DESC LIMIT 4")).fetchall()
        
        for alert in alerts:
            f.write(f"\nAlert ID {alert[0]} | Title: {alert[2]}\n")
            f.write(f"Message: {alert[3]}\n")
            tag = alert[4]
            
            f.write(f"  --> Checking invoice_line_items for Tag {tag}:\n")
            items = conn.execute(text(f"SELECT id, invoice_number, tag_number, amount FROM invoice_line_items WHERE tag_number = '{tag}'")).fetchall()
            for idx, item in enumerate(items):
                f.write(f"      {idx + 1}. ID: {item[0]} | Invoice: {item[1]} | Tag: {item[2]} | Amount: {item[3]}\n")
                
            f.write(f"  --> Checking inventory record for Tag {tag}:\n")
            inv = conn.execute(text(f"SELECT id, tag, invoice_number, sales_value FROM inventory WHERE tag = {int(tag)}")).fetchone()
            if inv:
                f.write(f"      Inventory ID: {inv[0]} | Current Invoice: {inv[2]} | Sales Value: {inv[3]}\n")
            else:
                f.write("      Inventory record not found.\n")
