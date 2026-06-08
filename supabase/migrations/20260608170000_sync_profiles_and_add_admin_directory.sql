-- 1. Create function to automatically handle new profiles
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_profile_created ON auth.users;

CREATE TRIGGER on_auth_user_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. Backfill profiles for existing users who are missing one
INSERT INTO public.profiles (id, username, full_name)
SELECT 
  id, 
  COALESCE(email, id::text), 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Create security definer function to query auth.users securely for admins
DROP VIEW IF EXISTS public.admin_user_directory CASCADE;
DROP FUNCTION IF EXISTS public.get_admin_user_directory();

CREATE OR REPLACE FUNCTION public.get_admin_user_directory()
RETURNS TABLE (
  user_id uuid,
  user_role text,
  full_name text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow access if query is run directly (not via API authenticator, e.g. Table Editor/SQL Editor), OR if caller is an admin
  IF SESSION_USER != 'authenticator' OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN QUERY
    SELECT 
      ur.id AS user_id,
      ur.role::text AS user_role,
      p.full_name::text,
      au.email::text,
      au.created_at,
      au.last_sign_in_at
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON ur.id = p.id
    LEFT JOIN auth.users au ON ur.id = au.id;
  ELSE
    RAISE EXCEPTION 'Access Denied: Only administrators can view the user directory.';
  END IF;
END;
$$;

-- 5. Expose the function through a view
CREATE OR REPLACE VIEW public.admin_user_directory AS
SELECT * FROM public.get_admin_user_directory();

-- 6. Grant read permission on the view to authenticated users
GRANT SELECT ON public.admin_user_directory TO authenticated;
