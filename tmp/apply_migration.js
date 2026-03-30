
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function restoreView() {
  try {
    console.log('Dropping old view...');
    await sql.unsafe('DROP VIEW IF EXISTS "inventory_report_view" CASCADE;');

    console.log('Creating inventory_report_view...');
    await sql.unsafe(`
      CREATE OR REPLACE VIEW "inventory_report_view" AS
      SELECT
          i.id,
          i.tag,
          i.invoice_number,
          i.line,
          i.produced,
          COALESCE(i.product_name, p.product_name) AS product_name,
          i.boardfeet,
          i.quantity,
          s.status_name AS current_status,
          i.inventory_value AS total_value,
          i.sales_value,
          i.customer_name,
          i.tagger AS tagger_name,
          i.length,
          i.width,
          i.rows,
          i.note,
          COALESCE(i.species_name, sp.species_name) AS species_name
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN species sp ON i.species_id = sp.id
      LEFT JOIN (
          SELECT DISTINCT ON (inventory_id)
              inventory_id,
              status_id
          FROM status_changes
          ORDER BY inventory_id, created_at DESC
      ) latest_status ON i.id = latest_status.inventory_id
      LEFT JOIN statuses s ON latest_status.status_id = s.id;
    `);

    console.log('View restored. Verifying...');
    const rows = await sql`SELECT tag, product_name, current_status, tagger_name FROM inventory_report_view LIMIT 3`;
    console.log(JSON.stringify(rows, null, 2));
    console.log('SUCCESS');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

restoreView();
