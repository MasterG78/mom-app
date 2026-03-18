import postgres from 'postgres';

const connectionString = 'postgresql://postgres:mQ9XsFnExTitu%23%23@db.boyleodbpsgqtjbstcua.supabase.co:5432/postgres';

async function fetchViews() {
    console.log("Connecting...");
    const sql = postgres(connectionString, {
        connect_timeout: 10
    });

    try {
        const views = await sql`
            SELECT table_name, view_definition 
            FROM information_schema.views 
            WHERE table_schema = 'public'
        `;
        console.log("VIEWS_START");
        console.log(JSON.stringify(views, null, 2));
        console.log("VIEWS_END");
    } catch (err) {
        console.log("ERROR_START");
        console.log(err.toString());
        console.log("ERROR_END");
    } finally {
        await sql.end();
    }
}

fetchViews();
