-- Create a function to check if any user exists (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_registered_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles LIMIT 1);
$$;