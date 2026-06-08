import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function run() {
  console.log('--- Inspecting get_admin_user_directory function ---');
  try {
    const result = await sql`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'get_admin_user_directory'
    `;
    if (result.length > 0) {
      console.log('Function definition:\n', result[0].routine_definition);
    } else {
      console.log('Function get_admin_user_directory not found.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

run();
