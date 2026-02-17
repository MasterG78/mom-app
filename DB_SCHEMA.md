| table_name                 | column_name           | data_type                | is_nullable | column_default    |
| -------------------------- | --------------------- | ------------------------ | ----------- | ----------------- |
| inventory                  | id                    | integer                  | NO          | null              |
| inventory                  | produced              | timestamp with time zone | NO          | now()             |
| inventory                  | tag                   | integer                  | NO          | null              |
| inventory                  | product_id            | bigint                   | YES         | null              |
| inventory                  | species_id            | bigint                   | YES         | null              |
| inventory                  | boardfeet             | numeric                  | YES         | null              |
| inventory                  | quantity              | smallint                 | YES         | null              |
| inventory                  | inventory_value       | numeric                  | YES         | null              |
| inventory                  | sales_value           | numeric                  | YES         | null              |
| inventory                  | invoice_id            | integer                  | YES         | null              |
| inventory                  | line                  | character varying        | YES         | null              |
| inventory                  | length                | numeric                  | YES         | null              |
| inventory                  | width                 | numeric                  | YES         | null              |
| inventory                  | rows                  | smallint                 | YES         | null              |
| inventory                  | note                  | text                     | YES         | null              |
| inventory                  | weight                | numeric                  | YES         | null              |
| inventory                  | tagger                | uuid                     | NO          | auth.uid()        |
| inventory                  | customer_name         | text                     | YES         | null              |
| inventory_report_view      | id                    | integer                  | YES         | null              |
| inventory_report_view      | tag                   | integer                  | YES         | null              |
| inventory_report_view      | invoice_id            | text                     | YES         | null              |
| inventory_report_view      | line                  | character varying        | YES         | null              |
| inventory_report_view      | produced              | timestamp with time zone | YES         | null              |
| inventory_report_view      | product_name          | character varying        | YES         | null              |
| inventory_report_view      | boardfeet             | numeric                  | YES         | null              |
| inventory_report_view      | quantity              | smallint                 | YES         | null              |
| inventory_report_view      | current_status        | character varying        | YES         | null              |
| inventory_report_view      | total_value           | numeric                  | YES         | null              |
| inventory_report_view      | sales_value           | numeric                  | YES         | null              |
| inventory_report_view      | customer_name         | text                     | YES         | null              |
| inventory_tag_sales_report | tag                   | integer                  | YES         | null              |
| inventory_tag_sales_report | product_name          | character varying        | YES         | null              |
| inventory_tag_sales_report | item_sale_price       | numeric                  | YES         | null              |
| inventory_tag_sales_report | qbo_invoice_number    | text                     | YES         | null              |
| inventory_tag_sales_report | customer_name         | text                     | YES         | null              |
| inventory_tag_sales_report | sale_date             | timestamp with time zone | YES         | null              |
| inventory_view             | id                    | integer                  | YES         | null              |
| inventory_view             | tag                   | integer                  | YES         | null              |
| inventory_view             | line                  | character varying        | YES         | null              |
| inventory_view             | boardfeet             | numeric                  | YES         | null              |
| inventory_view             | quantity              | smallint                 | YES         | null              |
| inventory_view             | produced              | timestamp with time zone | YES         | null              |
| inventory_view             | product_name          | character varying        | YES         | null              |
| inventory_view             | tagger_name           | text                     | YES         | null              |
| inventory_weekly_snapshots | id                    | bigint                   | NO          | null              |
| inventory_weekly_snapshots | created_at            | timestamp with time zone | YES         | now()             |
| inventory_weekly_snapshots | week_ending           | date                     | NO          | null              |
| inventory_weekly_snapshots | sales_value           | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | cogs_value            | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | gross_profit          | numeric                  | YES         | null              |
| inventory_weekly_snapshots | starting_value        | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | produced_value        | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | sold_value            | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | issued_value          | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | void_value            | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | expected_change       | numeric                  | YES         | null              |
| inventory_weekly_snapshots | actual_closing_value  | numeric                  | YES         | 0                 |
| inventory_weekly_snapshots | balance_check         | numeric                  | YES         | null              |
| inventory_weekly_snapshots | notes                 | text                     | YES         | null              |
| invoice_line_items         | id                    | uuid                     | NO          | gen_random_uuid() |
| invoice_line_items         | invoice_number        | text                     | YES         | null              |
| invoice_line_items         | customer_name         | text                     | YES         | null              |
| invoice_line_items         | tag_number            | text                     | YES         | null              |
| invoice_line_items         | description           | text                     | YES         | null              |
| invoice_line_items         | quantity              | numeric                  | YES         | null              |
| invoice_line_items         | rate                  | numeric                  | YES         | null              |
| invoice_line_items         | amount                | numeric                  | YES         | null              |
| invoice_line_items         | created_at            | timestamp with time zone | YES         | now()             |
| owner_weekly_trend_report  | week_ending           | date                     | YES         | null              |
| owner_weekly_trend_report  | Weekly Revenue        | numeric                  | YES         | null              |
| owner_weekly_trend_report  | Gross Profit          | numeric                  | YES         | null              |
| owner_weekly_trend_report  | Opening Inv           | numeric                  | YES         | null              |
| owner_weekly_trend_report  | Closing Inv           | numeric                  | YES         | null              |
| owner_weekly_trend_report  | Inv Growth %          | numeric                  | YES         | null              |
| owner_weekly_trend_report  | Expected Change       | numeric                  | YES         | null              |
| owner_weekly_trend_report  | Shrinkage/Discrepancy | numeric                  | YES         | null              |
| owner_weekly_trend_report  | notes                 | text                     | YES         | null              |
| products                   | id                    | bigint                   | NO          | null              |
| products                   | created_at            | timestamp with time zone | NO          | now()             |
| products                   | product_name          | character varying        | NO          | null              |
| products                   | unit_type             | character varying        | NO          | null              |
| products                   | unit_product_value    | numeric                  | NO          | null              |
| products                   | unit_inv_value        | numeric                  | NO          | null              |
| products                   | unit_boardfeet        | numeric                  | YES         | null              |
| products                   | default_length        | numeric                  | YES         | null              |
| products                   | default_quantity      | numeric                  | YES         | null              |
| products                   | menu_show             | boolean                  | YES         | true              |
| products                   | species_id            | bigint                   | YES         | null              |
| products                   | group_id              | bigint                   | YES         | null              |
| products                   | account               | smallint                 | YES         | null              |
| products                   | account_product       | character varying        | YES         | null              |
| products                   | thickness             | numeric                  | NO          | 1.00              |
| products                   | is_special_order      | boolean                  | YES         | false             |
| profiles                   | id                    | uuid                     | NO          | null              |
| profiles                   | updated_at            | timestamp with time zone | YES         | null              |
| profiles                   | username              | text                     | NO          | null              |
| profiles                   | full_name             | text                     | YES         | null              |
| qbo_invoices               | id                    | bigint                   | NO          | null              |
| qbo_invoices               | created_at            | timestamp with time zone | NO          | now()             |
| qbo_invoices               | qbo_id                | text                     | YES         | null              |
| qbo_invoices               | raw_data              | jsonb                    | YES         | null              |
| species                    | id                    | bigint                   | NO          | null              |
| species                    | species_name          | character varying        | NO          | null              |
| species_groups             | id                    | bigint                   | NO          | null              |
| species_groups             | group_name            | character varying        | YES         | null              |
| species_groups             | species_id            | smallint                 | YES         | null              |
| status_changes             | id                    | bigint                   | NO          | null              |
| status_changes             | created_at            | timestamp with time zone | NO          | now()             |
| status_changes             | inventory_id          | bigint                   | NO          | null              |
| status_changes             | status_id             | bigint                   | NO          | null              |
| status_changes             | updated_by            | uuid                     | NO          | null              |
| status_changes             | updated_at            | timestamp with time zone | NO          | now()             |
| status_changes             | notes                 | text                     | YES         | null              |
| status_history_view        | id                    | bigint                   | YES         | null              |
| status_history_view        | inventory_id          | bigint                   | YES         | null              |
| status_history_view        | updated_at            | timestamp with time zone | YES         | null              |
| status_history_view        | notes                 | text                     | YES         | null              |
| status_history_view        | status_name           | character varying        | YES         | null              |
| status_history_view        | status_description    | character varying        | YES         | null              |
| status_history_view        | updater_name          | text                     | YES         | null              |
| statuses                   | id                    | bigint                   | NO          | null              |
| statuses                   | status_name           | character varying        | NO          | null              |
| statuses                   | status_description    | character varying        | YES         | null              |