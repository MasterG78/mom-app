
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Initialize with Service Role Key for Admin access
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const EMAIL = 'ai-test@mountainoakmill.com';
const PASSWORD = 'ai-test-password-1348ece6';

async function createAiUser() {
  console.log(`Checking if user ${EMAIL} already exists...`);
  
  // 1. Get existing users
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  let user = users.users.find(u => u.email === EMAIL);

  if (!user) {
    console.log(`Creating user ${EMAIL}...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    user = newUser.user;
    console.log('User created successfully:', user.id);
  } else {
    console.log('User already exists. Updating password just in case...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: PASSWORD
    });
    if (updateError) {
      console.error('Error updating user password:', updateError);
    } else {
      console.log('Password updated.');
    }
  }

  // 2. Ensure role is set in user_roles table
  console.log(`Setting role 'admin' for user ${user.id} in user_roles table...`);
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ id: user.id, role: 'admin' }, { onConflict: 'id' });

  if (roleError) {
    console.error('Error setting user role:', roleError);
  } else {
    console.log('User role set to admin successfully.');
  }

  console.log('\n--- Setup Complete ---');
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Role: admin`);
}

createAiUser();
