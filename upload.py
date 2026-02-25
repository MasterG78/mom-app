# -*- coding: utf-8 -*-
"""
This script extracts data from an MS Access database, transforms it,
and uploads it to a Supabase (PostgreSQL) database.

The process involves:
1. Establishing connections to both databases.
2. Pulling the latest records from the Access database.
3. Cleaning and preprocessing the extracted data.
4. Fetching lookup tables from Supabase for mapping.
5. Merging and transforming the data to match the Supabase schema.
6. Uploading the final dataset to the Supabase 'inventory' table.
"""

import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()


def connect_to_supabase():
    """
    Establishes a connection to the Supabase (PostgreSQL) database.

    Returns:
        sqlalchemy.engine.base.Engine: The database engine object.
    """
    connection_string = os.getenv("SUPABASE_CONNECTION_STRING")
    if not connection_string:
        raise ValueError("SUPABASE_CONNECTION_STRING environment variable not set.")
    return create_engine(connection_string)


def pull_data_from_access(conn, current_date):
    """
    Pulls records from the TicketTbl that are either 'In Stock' ('IN')
    or have an ExitDate within the last 7 days, sorted chronologically.

    Args:
        conn: The connection object for the Access database.
        current_date: The current date, used to calculate the 7-day window.

    Returns:
        pandas.DataFrame: A DataFrame containing the cleaned data from Access.
    """
    # Calculate the date 7 days ago for the query parameter
    seven_days_ago = current_date - timedelta(days=7)

    # Pull all records with 'IN' status, plus any record with a recent ExitDate.
    # The data is ordered chronologically, which is the desired processing order.
    query = (
        "SELECT * FROM TicketTbl "
        "WHERE Status = 'IN' OR ExitDate >= ? "
        "ORDER BY CDate(Produced), Val(Ticket)"
    )
    df_access = pd.read_sql(query, conn, params=(seven_days_ago.strftime('%Y-%m-%d'),))

    # Clean data to prevent "false misses" during merging
    df_access['Product'] = df_access['Product'].str.strip()
    df_access['Species'] = df_access['Species'].str.strip()

    return df_access


def pull_lookup_data_from_supabase(engine):
    """
    Pulls lookup tables for products and species from the Supabase database.

    Args:
        engine: The database engine object for Supabase.

    Returns:
        tuple: A tuple containing two DataFrames (df_products, df_species).
    """
    df_products = pd.read_sql("SELECT id as product_id, product_name FROM products", engine)
    df_species = pd.read_sql("SELECT id as species_id, species_name FROM species", engine)
    return df_products, df_species


def map_and_transform_data(df_access, df_products, df_species):
    """
    Merges the Access data with Supabase lookup tables, renames columns,
    and selects the final set of columns for upload.

    Args:
        df_access (pandas.DataFrame): DataFrame from the Access database.
        df_products (pandas.DataFrame): DataFrame of products from Supabase.
        df_species (pandas.DataFrame): DataFrame of species from Supabase.

    Returns:
        pandas.DataFrame: The final transformed and cleaned DataFrame.
    """
    # Perform a left merge to find matching 'product_id' and 'species_id'
    # This keeps all Access rows; non-matches will have NaN for the merged keys.
    df_mapped = df_access.merge(
        df_products,
        left_on='Product',
        right_on='product_name',
        how='left'
    )
    df_mapped = df_mapped.merge(
        df_species,
        left_on='Species',
        right_on='species_name',
        how='left'
    )

    # Define the mapping from Access column names to Supabase column names
    column_mapping = {
        'Produced': 'produced',
        'Ticket': 'tag',
        'Line': 'line',
        'BoardFt': 'boardfeet',
        'Qty': 'quantity',
        'BundleVal': 'inventory_value',
        'Note': 'note',
        'Length': 'length',
        'Width': 'width',
        'Rows': 'rows',
        'Weight': 'weight'
    }
    df_mapped = df_mapped.rename(columns=column_mapping)

    # Clean the 'tag' column to remove non-numeric characters and drop rows with no numbers
    df_mapped['tag'] = df_mapped['tag'].astype(str).str.extract(r'(\d+)').astype(float)
    df_mapped.dropna(subset=['tag'], inplace=True)
    df_mapped['tag'] = df_mapped['tag'].astype('Int64')

    # Clean the 'note' column and set 'tagger' from the 'Tagged' column.
    df_mapped['note'] = df_mapped['note'].fillna('')
    df_mapped['tagger'] = df_mapped['Tagged'].fillna('')
    
    # Select and order the final columns for upload.
    # Unmatched records will have NaN for 'product_id' or 'species_id',
    # which will be uploaded as NULL to Supabase.
    final_cols = [
        'produced', 'tag', 'product_id', 'species_id', 'line',
        'boardfeet', 'quantity', 'inventory_value', 'note',
        'tagger', 'length', 'width', 'rows', 'weight'
    ]
    # Ensure all required columns exist, adding missing ones with None
    for col in final_cols:
        if col not in df_mapped:
            df_mapped[col] = None

    return df_mapped[final_cols]


def upload_to_supabase(df, engine):
    """
    Uploads the final DataFrame to the 'inventory' table in Supabase,
    performing an "upsert" (insert or update) based on the 'tag' column.

    Args:
        df (pandas.DataFrame): The DataFrame to upload.
        engine: The database engine for Supabase.
    """
    if df.empty:
        print("No data to upload.")
        return

    temp_table_name = "inventory_temp_upsert"

    try:
        # Upload data to a temporary table. pandas infers column types,
        # which might not match the target table (e.g., uuid as text).
        df.to_sql(temp_table_name, engine, if_exists='replace', index=False)

        # Prepare column lists for the SQL query
        cols = df.columns.tolist()

        # For the INSERT part, we just need the column names
        insert_cols_sql = ", ".join([f'"{c}"' for c in cols])

        # For the SELECT part, we must explicitly cast columns to match the target table's datatypes
        select_cols = [f'"{c}"' for c in cols]
        select_cols_sql = ", ".join(select_cols)

        # For the UPDATE part of the query
        update_sql = ", ".join([f'"{c}" = EXCLUDED."{c}"' for c in cols if c != 'tag'])

        # Construct the upsert query with the explicit cast
        upsert_query = f"""
        INSERT INTO inventory ({insert_cols_sql})
        SELECT {select_cols_sql} FROM {temp_table_name}
        ON CONFLICT (tag) DO UPDATE SET
            {update_sql};
        """

        # Execute the transaction
        with engine.begin() as conn:
            # Set the user context for the transaction to ensure the trigger
            # that updates the status_changes table can correctly identify the user.
            user_id = '71c80b7d-61ac-47cf-9998-f482553fc54a'
            jwt_payload = f'{{"sub": "{user_id}"}}'
            conn.execute(text(f"SET request.jwt.claims = '{jwt_payload}'"))

            result = conn.execute(text(upsert_query))
            print(f"Upload complete. {result.rowcount} records were inserted or updated.")

    except Exception as e:
        print(f"An error occurred during upsert: {e}")
    finally:
        # Ensure the temporary table is dropped
        with engine.begin() as conn:
            conn.execute(text(f"DROP TABLE IF EXISTS {temp_table_name};"))


def add_status_changes(df, engine):
    """
    Adds status changes to the 'status_changes' table in Supabase.

    Args:
        df (pandas.DataFrame): The DataFrame containing the data from Access.
        engine: The database engine for Supabase.
    """
    if df.empty:
        print("No status changes to upload.")
        return

    try:
        # 1. Fetch statuses and inventory from Supabase
        df_statuses = pd.read_sql("SELECT id as status_id, status_name FROM statuses", engine)
        df_inventory = pd.read_sql("SELECT id as inventory_id, tag FROM inventory", engine)

        # 2. Map status names to status IDs
        status_mapping = {
            'IN': 'In Stock',
            'SO': 'Sold',
            'VD': 'Void',
            'MI': 'Missing',
            'IS': 'Issued'
        }
        df['status_name'] = df['Status'].map(status_mapping)

        # 3. Merge with statuses and inventory to get the IDs
        df_merged = df.merge(df_statuses, on='status_name', how='left')
        df_merged['tag'] = df_merged['Ticket'].astype(str).str.extract(r'(\d+)').astype(float)
        df_merged.dropna(subset=['tag'], inplace=True)
        df_merged['tag'] = df_merged['tag'].astype('Int64')
        df_merged = df_merged.merge(df_inventory, on='tag', how='left')
        
        # 4. Prepare the data for insertion
        df_final = df_merged[['inventory_id', 'status_id']].copy()
        df_final.dropna(inplace=True)
        df_final['updated_by'] = '71c80b7d-61ac-47cf-9998-f482553fc54a'
        df_final['created_at'] = datetime.now()

        # 5. Insert into status_changes
        with engine.begin() as conn:
            df_final.to_sql('status_changes', conn, if_exists='append', index=False)
            print(f"Added {len(df_final)} status changes.")

    except Exception as e:
        print(f"An error occurred during status changes update: {e}")


def reconcile_invoice_line_items(engine, system_user_id):
    """
    After the daily inventory upsert, find any invoice_line_items rows that
    now have a matching inventory record but haven't been applied yet.

    This handles the pre-production scenario where invoices arrive in real-time
    before inventory items are entered -- the invoice data sits waiting in
    invoice_line_items and is picked up here once inventory exists.

    The guard (i.invoice_number IS DISTINCT FROM ili.invoice_number) ensures
    we skip rows the real-time DB trigger already processed, preventing
    duplicate status_changes entries.

    Args:
        engine: The database engine for Supabase.
        system_user_id (str): UUID string used as the 'updated_by' actor.
    """
    try:
        # Find all invoice_line_items that now match an inventory tag
        # but whose data hasn't been applied to that inventory row yet.
        unreconciled_query = """
            SELECT
                ili.tag_number,
                ili.invoice_number,
                ili.amount,
                ili.customer_name,
                i.id   AS inventory_id
            FROM invoice_line_items ili
            INNER JOIN inventory i
                ON i.tag = ili.tag_number::integer
            WHERE
                ili.tag_number IS NOT NULL
                AND TRIM(ili.tag_number) != ''
                -- Skip rows the real-time trigger already handled
                AND (i.invoice_number IS DISTINCT FROM ili.invoice_number)
        """
        df_unreconciled = pd.read_sql(unreconciled_query, engine)

        if df_unreconciled.empty:
            print("Invoice reconciliation: nothing to reconcile.")
            return

        print(f"Invoice reconciliation: {len(df_unreconciled)} line item(s) to apply.")

        # Look up the 'Sold' status ID once
        df_statuses = pd.read_sql(
            "SELECT id, status_name FROM statuses WHERE status_name = 'Sold' LIMIT 1",
            engine
        )
        if df_statuses.empty:
            print("Warning: 'Sold' status not found in statuses table. Skipping reconciliation.")
            return
        sold_status_id = int(df_statuses.iloc[0]['id'])

        with engine.begin() as conn:
            for _, row in df_unreconciled.iterrows():
                inventory_id = int(row['inventory_id'])
                invoice_number = row['invoice_number']
                amount = row['amount']
                customer_name = row['customer_name']

                # 1. Update the inventory record with the invoice snapshot
                conn.execute(text("""
                    UPDATE inventory
                    SET
                        invoice_number = :invoice_number,
                        sales_value    = :amount,
                        customer_name  = :customer_name
                    WHERE id = :inventory_id
                """), {
                    'invoice_number': invoice_number,
                    'amount': amount,
                    'customer_name': customer_name,
                    'inventory_id': inventory_id
                })

                # 2. Append a Sold audit entry to status_changes
                conn.execute(text("""
                    INSERT INTO status_changes
                        (inventory_id, status_id, updated_by, notes)
                    VALUES
                        (:inventory_id, :status_id, :updated_by, :notes)
                """), {
                    'inventory_id': inventory_id,
                    'status_id': sold_status_id,
                    'updated_by': system_user_id,
                    'notes': f'Sold on Invoice #{invoice_number}'
                })

        print(f"Invoice reconciliation: complete. {len(df_unreconciled)} record(s) updated.")

    except Exception as e:
        print(f"An error occurred during invoice reconciliation: {e}")


def main():


    """


    Main function to orchestrate the ETL process.


    """


    # 1. SETUP CONNECTIONS


    # For MS Access, you need the correct ODBC driver installed.


    # Ensure the driver architecture (32-bit/64-bit) matches your Python installation.


    access_conn_str = (


        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"


        r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"


    )


    access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')





    supabase_engine = connect_to_supabase()





    if access_conn is None:


        print("MS Access connection is not configured. Aborting.")


        return





    # 2. RUN ETL PROCESS


    try:


        current_date = datetime.now().date()


        df_access = pull_data_from_access(access_conn, current_date)


        print(f"Pulled {len(df_access)} records from Access.")


        


        df_products, df_species = pull_lookup_data_from_supabase(supabase_engine)


        


        df_final = map_and_transform_data(df_access, df_products, df_species)


        print(f"Processing {len(df_final)} records for upload.")





        upload_to_supabase(df_final, supabase_engine)
        add_status_changes(df_access, supabase_engine)

        # Reconcile any invoice_line_items that arrived before today's inventory.
        # Uses the same system user as the status_changes inserts above.
        system_user_id = '71c80b7d-61ac-47cf-9998-f482553fc54a'
        reconcile_invoice_line_items(supabase_engine, system_user_id)


    except Exception as e:


        print(f"An error occurred: {e}")


    finally:


        # Dispose of the engine connection if it's a SQLAlchemy engine


        if hasattr(access_conn, 'dispose'):


            access_conn.dispose()


        supabase_engine.dispose()


if __name__ == "__main__":
    main()
