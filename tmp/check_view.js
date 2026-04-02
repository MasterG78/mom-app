
import postgres from 'postgres';
const connectionString = 'postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString);

async function run() {
  try {
    const view = await sql`SELECT view_definition FROM information_schema.views WHERE table_name = 'owner_weekly_trend_report'`;
    console.log('VIEW_DEFINITION_START');
    console.log(view[0].view_definition);
    console.log('VIEW_DEFINITION_END');
  } catch (e) {
    console.error(e.message);
  } finally {
    await sql.end();
  }
}
run();
