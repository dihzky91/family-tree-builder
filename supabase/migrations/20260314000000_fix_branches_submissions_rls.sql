-- Migration: Fix RLS policies for branches and submissions
-- Ensure only admins/owners can manage all data, not all authenticated users

-- First, drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can manage submissions" ON public.submissions;

-- Create a function to check if user is admin (can be customized)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has admin claim in their JWT
  -- You can customize this logic based on your needs
  -- For now, we'll use a simple check - first user created is admin
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND created_at = (SELECT MIN(created_at) FROM auth.users)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Branches policies - only admins can manage all branches
CREATE POLICY "Admins can manage all branches"
  ON public.branches FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Submissions policies - only admins can review/manage all submissions
-- Public can still create submissions (for contribution form)
DROP POLICY IF EXISTS "Public can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can view approved submissions" ON public.submissions;

-- Public can create submissions
CREATE POLICY "Public can create submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (true);

-- Public can view approved submissions
CREATE POLICY "Public can view approved submissions"
  ON public.submissions FOR SELECT
  USING (status = 'approved');

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
  ON public.submissions FOR SELECT
  USING (public.is_admin());

-- Admins can update submissions (for approval/rejection)
CREATE POLICY "Admins can update submissions"
  ON public.submissions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete submissions
CREATE POLICY "Admins can delete submissions"
  ON public.submissions FOR DELETE
  USING (public.is_admin());

COMMENT ON FUNCTION public.is_admin() IS 'Checks if current user is the first registered user (admin)';
