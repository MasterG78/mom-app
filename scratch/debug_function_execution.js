import postgres from 'postgres';

const connectionString = "postgresql://postgres.boyleodbpsgqtjbstcua:Mom11343Supapass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
// Register onnotice handler during client creation
const sql = postgres(connectionString, {
  onnotice: (notice) => {
    console.log('NOTICE FROM POSTGRES:', notice.message);
  }
});

async function run() {
  console.log('--- Debugging function execution with RAISE NOTICE ---');

  try {
    // 1. Create a debug version of the function that raises notices
    await sql`
      CREATE OR REPLACE FUNCTION public.debug_get_admin_user_directory()
      RETURNS TABLE (
        user_id uuid,
        user_role text,
        full_name text,
        email text
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_current_user text;
        v_auth_uid uuid;
        v_exists_admin boolean;
      BEGIN
        v_current_user := CURRENT_USER;
        v_auth_uid := auth.uid();
        
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE id = v_auth_uid AND role = 'admin'
        ) INTO v_exists_admin;

        RAISE NOTICE 'debug_get_admin_user_directory called: CURRENT_USER=%, auth.uid()=%, exists_admin=%', 
          v_current_user, v_auth_uid, v_exists_admin;

        IF v_current_user IN ('postgres', 'service_role', 'supabase_admin') OR v_exists_admin THEN
          RETURN QUERY
          SELECT 
            ur.id AS user_id,
            ur.role::text AS user_role,
            p.full_name::text,
            au.email::text
          FROM public.user_roles ur
          LEFT JOIN public.profiles p ON ur.id = p.id
          LEFT JOIN auth.users au ON ur.id = au.id;
        ELSE
          RAISE EXCEPTION 'Access Denied: Only administrators can view the user directory.';
        END IF;
      END;
      $$;
    `;

    // 2. Execute it for the sawmill user
    await sql.begin(async sql => {
      await sql`SET LOCAL ROLE authenticated`;
      await sql`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: '21432519-d96f-4df0-9fb0-b07abe6e3073' })}, true)`;
      
      const res = await sql`SELECT * FROM public.debug_get_admin_user_directory()`;
      console.log('Results count:', res.length);
    });

  } catch (error) {
    console.error('Caught error:', error.message);
  } finally {
    // Clean up debug function
    await sql`DROP FUNCTION IF EXISTS public.debug_get_admin_user_directory()`;
    await sql.end();
  }
}

run();
