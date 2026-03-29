import os
import pandas as pd
from sqlalchemy import create_engine

access_conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    r"DBQ=G:\Shared drives\Hamilton Production\MOMProduction.accdb;"
)
access_conn = create_engine(f'access+pyodbc:///?odbc_connect={access_conn_str.replace(" ", "%20")}')

# Check the 3 missing tags specifically
tags = [41149, 48989, 48990]
tags_str = ", ".join([f"'{t}'" for t in tags]) # Access Ticket is often a string

query = f"SELECT Ticket, Product FROM TicketTbl WHERE Ticket IN ({tags_str})"
df = pd.read_sql(query, access_conn)
print("Data from Access for the 3 missing tags:")
print(df)
