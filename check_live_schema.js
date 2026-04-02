
import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkSchema() {
  console.log('--- Checking for Key Tables and Functions on Live DB ---');
  try {
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const tableNames = tables.map(t => t.table_name);
    
    const objects = ['inventory_audit', 'production_goals', 'inventory', 'profiles'];
    objects.forEach(obj => {
      console.log(`- Table [${obj}]: ${tableNames.includes(obj) ? '✅ Present' : '❌ Missing'}`);
    });

    const views = await sql`SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`;
    const viewNames = views.map(v => v.table_name);
    const targetViews = ['inventory_view', 'inventory_report_view'];
    targetViews.forEach(v => {
      console.log(`- View [${v}]: ${viewNames.includes(v) ? '✅ Present' : '❌ Missing'}`);
    });

    const functions = await sql`SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'`;
    const funcNames = functions.map(f => f.routine_name);
    const targetFuncs = ['sync_invoice_line_items', 'upsert_invoices_bulk'];
    targetFuncs.forEach(f => {
      console.log(`- Function [${f}]: ${funcNames.includes(f) ? '✅ Present' : '❌ Missing'}`);
    });

  } catch (error) {
    console.error('Error checking schema:', error.message);
  } finally {
    await sql.end();
  }
}

checkSchema();
