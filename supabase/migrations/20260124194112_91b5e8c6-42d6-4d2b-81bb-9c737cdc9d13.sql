-- Tighten submissions RLS policies (avoid permissive true checks)

DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Authenticated users can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Authenticated users can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Authenticated users can delete submissions" ON public.submissions;

-- INSERT: allow anon/authenticated but require basic non-empty fields
CREATE POLICY "Anyone can create submissions"
ON public.submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  branch_id IS NOT NULL
  AND full_name IS NOT NULL
  AND length(trim(full_name)) > 0
  AND submitted_by IS NOT NULL
  AND length(trim(submitted_by)) > 0
  AND relation_to_branch IS NOT NULL
  AND gender IS NOT NULL
);

-- SELECT: authenticated users can view all (still requires being authenticated)
CREATE POLICY "Authenticated users can view all submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- UPDATE/DELETE: authenticated only
CREATE POLICY "Authenticated users can update submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');