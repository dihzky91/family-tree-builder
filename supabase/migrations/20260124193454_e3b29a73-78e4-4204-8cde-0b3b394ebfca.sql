-- Drop conflicting policies
DROP POLICY IF EXISTS "Authenticated users can manage submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can view approved submissions" ON public.submissions;

-- Create proper policies for submissions table

-- 1. Anyone (anon or authenticated) can INSERT submissions
CREATE POLICY "Anyone can create submissions" 
ON public.submissions 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- 2. Authenticated users can view all submissions
CREATE POLICY "Authenticated users can view all submissions" 
ON public.submissions 
FOR SELECT 
TO authenticated
USING (true);

-- 3. Anonymous users can only view approved submissions
CREATE POLICY "Anonymous can view approved submissions" 
ON public.submissions 
FOR SELECT 
TO anon
USING (status = 'approved');

-- 4. Only authenticated users can update submissions
CREATE POLICY "Authenticated users can update submissions" 
ON public.submissions 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Only authenticated users can delete submissions
CREATE POLICY "Authenticated users can delete submissions" 
ON public.submissions 
FOR DELETE 
TO authenticated
USING (true);