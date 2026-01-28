import postgres from 'postgres';

// Using encoded password from generate-schema.js
const connectionString = 'postgresql://postgres:mQ9XsFnExTitu%23%23@db.boyleodbpsgqtjbstcua.supabase.co:5432/postgres';

async function testConnection() {
    console.log("Testing connection with family: 6 option...");

    // Attempt 1: Force IPv6
    const sql = postgres(connectionString, {
        connect_timeout: 10,
        // Pass family: 6 to underlying socket. 
        // Note: postgres.js might not pass this directly in all versions, 
        // but let's try. Alternatively, we can use dns.setDefaultResultOrder('verbatim') in Node 17+
        family: 6
    });

    try {
        const result = await sql`SELECT 1 as connected`;
        console.log("SUCCESS! Connected via IPv6.");
        console.log(result);
    } catch (err) {
        console.error("FAILED with family: 6.");
        console.error(err.message);
    } finally {
        await sql.end();
    }
}

testConnection();
