-- Script: get_schema_info.sql
-- Description: Lists all tables and columns in the user's public schema.
--              Run this to get an updated view of your database structure.

SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
ORDER BY 
    table_name, 
    ordinal_position;
