import postgres from 'postgres';
import dns from 'dns/promises';

const connectionURL = new URL('postgresql://postgres:mQ9XsFnExTitu%23%23@db.boyleodbpsgqtjbstcua.supabase.co:5432/postgres');

async function testConnection() {
    console.log(`Resolving ${connectionURL.hostname}...`);

    try {
        // Manually resolve IPv6
        const addresses = await dns.resolve6(connectionURL.hostname);
        if (addresses.length > 0) {
            const ip = addresses[0];
            console.log(`Resolved to ${ip}. Connecting...`);

            // Reconstruct connection string with IP
            // Note: IPv6 addresses in URLs must be bracketed [ ]
            connectionURL.hostname = `[${ip}]`;

            const sql = postgres(connectionURL.toString(), {
                connect_timeout: 10,
                // We likely need to set ssl to prevent host mismatch errors, 
                // or use ssl: { rejectUnauthorized: false } since generic certificate won't match IP
                ssl: { rejectUnauthorized: false }
            });

            const result = await sql`SELECT 1 as connected`;
            console.log("SUCCESS! Connected using resolved IP.");
            console.log(result);
            await sql.end();
            return;
        }
    } catch (err) {
        console.error("Resolution or Connection failed:", err);
    }
}

testConnection();
