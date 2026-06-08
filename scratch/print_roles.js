import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function run() {
  console.log('--- Printing all user_roles ---');
  try {
    const roles = await sql`SELECT * FROM public.user_roles`;
    console.log(roles);
  } catch (error) {
    console.error(error);
  } finally {
    await sql.end();
  }
}

run();
