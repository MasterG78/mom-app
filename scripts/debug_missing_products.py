import os
import pandas as pd
from sqlalchemy import create_engine

access_conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"
)
access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')

# Get some rows to see data types
query = "SELECT TOP 100 Ticket, Product FROM TicketTbl"
df = pd.read_sql(query, access_conn)
print("Sample rows from TicketTbl:")
print(df.head(10))
print("\nData types:")
print(df.dtypes)

# Check if our sample tags are in the first 100
sample_tags = [39053, 39064, 39103, 39397, 39428, 39435]
df['Ticket_int'] = pd.to_numeric(df['Ticket'], errors='coerce')
found = df[df['Ticket_int'].isin(sample_tags)]
if not found.empty:
    print("\nFound some of our sample tags:")
    print(found)
else:
    print("\nSample tags not found in TOP 100.")
