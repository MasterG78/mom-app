import os
import re
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

load_dotenv()

def apply_auto_tag_migration():
    url = URL.create(
        drivername="postgresql+psycopg2",
        host=os.getenv("SUPABASE_DB_HOST"),
        port=int(os.getenv("SUPABASE_DB_PORT", 5432)),
        database=os.getenv("SUPABASE_DB_NAME"),
        username=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
    )
    engine = create_engine(url)
    
    sql_path = r'c:\projects\supabase\mom\mom-app\supabase\migrations\add_auto_tag_parsing.sql'
    
    if not os.path.exists(sql_path):
        print(f"Error: SQL file not found at {sql_path}")
        return

    with open(sql_path, 'r') as f:
        full_sql = f.read()
    
    # Simple split by semicolon, but we must NOT split inside $$ blocks
    # This is a bit tricky with pure regex.
    # Instead, let's just group the function and the trigger logic.
    
    statements = [
        # Statement 1: The Function
        """
        CREATE OR REPLACE FUNCTION parse_tag_from_description()
        RETURNS TRIGGER AS $$
        DECLARE
            extracted_tag_text text;
        BEGIN
            IF NEW.tag_number IS NULL THEN
                extracted_tag_text := substring(NEW.description FROM '^(\\d+)');
                IF extracted_tag_text IS NULL THEN
                    extracted_tag_text := substring(NEW.description FROM 'Tag[\\s:#]+(\\d+)');
                END IF;
                IF extracted_tag_text IS NOT NULL THEN
                    NEW.tag_number := extracted_tag_text::numeric;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        # Statement 2: Drop Trigger
        "DROP TRIGGER IF EXISTS trigger_auto_parse_tag ON invoice_line_items;",
        # Statement 3: Create Trigger
        """
        CREATE TRIGGER trigger_auto_parse_tag
        BEFORE INSERT OR UPDATE ON invoice_line_items
        FOR EACH ROW
        EXECUTE FUNCTION parse_tag_from_description();
        """
    ]
        
    print(f"Applying statements from {sql_path} one by one...")
    try:
        with engine.begin() as conn:
            for stmt in statements:
                print(f"Executing statement...")
                conn.execute(text(stmt))
        print("All statements applied successfully!")
    except Exception as e:
        print(f"Error applying SQL: {e}")

if __name__ == "__main__":
    apply_auto_tag_migration()
