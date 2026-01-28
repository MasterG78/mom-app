| markdown_report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ## Table: inventory
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int4` | NO | - |
| **produced** | `timestamptz` | NO | `now()` |
| **tag** | `int4` | NO | - |
| **product_id** | `int8` | YES | - |
| **species_id** | `int8` | YES | - |
| **boardfeet** | `numeric` | YES | - |
| **quantity** | `int2` | YES | - |
| **inventory_value** | `numeric` | YES | - |
| **sales_value** | `numeric` | YES | - |
| **invoice_id** | `int4` | YES | - |
| **line** | `varchar` | YES | - |
| **length** | `numeric` | YES | - |
| **width** | `numeric` | YES | - |
| **rows** | `int2` | YES | - |
| **note** | `text` | YES | - |
| **weight** | `numeric` | YES | - |
| **tagger** | `uuid` | NO | `auth.uid()` |
 |
| ## Table: products
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int8` | NO | - |
| **created_at** | `timestamptz` | NO | `now()` |
| **product_name** | `varchar` | NO | - |
| **unit_type** | `varchar` | NO | - |
| **unit_product_value** | `numeric` | NO | - |
| **unit_inv_value** | `numeric` | NO | - |
| **unit_boardfeet** | `numeric` | YES | - |
| **default_length** | `numeric` | YES | - |
| **default_quantity** | `numeric` | YES | - |
| **menu_show** | `bool` | YES | `true` |
| **species_id** | `int8` | YES | - |
| **group_id** | `int8` | YES | - |
| **account** | `int2` | YES | - |
| **account_product** | `varchar` | YES | - |
| **thickness** | `numeric` | NO | `1.00` |
          |
| ## Table: species
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int8` | NO | - |
| **species_name** | `varchar` | NO | - |
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ## Table: species_groups
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int8` | NO | - |
| **group_name** | `varchar` | YES | - |
| **species_id** | `int2` | YES | - |
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ## Table: status_changes
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int8` | NO | - |
| **created_at** | `timestamptz` | NO | `now()` |
| **inventory_id** | `int8` | NO | - |
| **status_id** | `int8` | NO | - |
| **updated_by** | `uuid` | NO | - |
| **updated_at** | `timestamptz` | NO | `now()` |
| **notes** | `text` | YES | - |
                                                                                                                                                                                                                                                                                                                                                                         |
| ## Table: StatusList
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int8` | NO | - |
| **status_name** | `varchar` | NO | - |
| **status_description** | `varchar` | YES | - |
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ## Table: inventory_report_view
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int4` | YES | - |
| **tag** | `int4` | YES | - |
| **line** | `varchar` | YES | - |
| **produced** | `timestamptz` | YES | - |
| **product_name** | `varchar` | YES | - |
| **boardfeet** | `numeric` | YES | - |
| **quantity** | `int2` | YES | - |
| **current_status** | `varchar` | YES | - |
| **total_value** | `numeric` | YES | - |
                                                                                                                                                                                                                                                                                          |
| ## Table: inventory_view
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int4` | YES | - |
| **tag** | `int4` | YES | - |
| **line** | `varchar` | YES | - |
| **boardfeet** | `numeric` | YES | - |
| **quantity** | `int2` | YES | - |
| **produced** | `timestamptz` | YES | - |
| **product_name** | `varchar` | YES | - |
| **tagger_name** | `text` | YES | - |
                                                                                                                                                                                                                                                                                                                                                 |
| ## Table: profiles
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `uuid` | NO | - |
| **updated_at** | `timestamptz` | YES | - |
| **username** | `text` | NO | - |
| **full_name** | `text` | YES | - |
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ## Table: status_history_view
| Column | Type | Nullable | Default |
| :--- | :--- | :--- | :--- |
| **id** | `int8` | YES | - |
| **inventory_id** | `int8` | YES | - |
| **updated_at** | `timestamptz` | YES | - |
| **notes** | `text` | YES | - |
| **status_name** | `varchar` | YES | - |
| **status_description** | `varchar` | YES | - |
| **updater_name** | `text` | YES | - |
                                                                                                                                                                                                                                                                                                                                                              |