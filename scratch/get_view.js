import postgres from 'postgres';
const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
async function run() {
    try {
        const res = await sql`SELECT view_definition FROM information_schema.views WHERE table_name = 'owner_weekly_trend_report'`;
        console.log(res[0].view_definition);
    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}
run();
