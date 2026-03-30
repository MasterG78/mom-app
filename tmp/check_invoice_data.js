
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkInvoiceData() {
  try {
    const data = await sql`
      SELECT * 
      FROM invoice_line_items 
      LIMIT 1
    `;
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

checkInvoiceData();
