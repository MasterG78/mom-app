import postgres from 'postgres';

const sql = postgres('postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres');

async function checkResponse() {
  try {
    const responses = await sql`SELECT * FROM net.http_responses ORDER BY created_at DESC LIMIT 1`;
    console.log(JSON.stringify(responses, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

checkResponse();
