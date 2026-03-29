import os
import pandas as pd
from sqlalchemy import create_engine

access_conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"
)
access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')

# Get the column names from TicketTbl
df = pd.read_sql("SELECT TOP 1 * FROM TicketTbl", access_conn)
print("Columns in TicketTbl:")
for col in df.columns:
    print(f"  {col}")

# Also check the ProductTbl table in Access if it exists
try:
    df_products = pd.read_sql("SELECT TOP 1 * FROM ProductTbl", access_conn)
    print("\nColumns in ProductTbl:")
    for col in df_products.columns:
        print(f"  {col}")
except Exception as e:
    print(f"\nCould not read ProductTbl: {e}")
