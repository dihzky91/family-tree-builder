-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false);

-- Policy: Users can view their own evidence files
CREATE POLICY "Users can view their own evidence files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'evidence' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can upload their own evidence files
CREATE POLICY "Users can upload their own evidence files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'evidence' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own evidence files
CREATE POLICY "Users can update their own evidence files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'evidence' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own evidence files
CREATE POLICY "Users can delete their own evidence files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'evidence' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add file_url column to evidence table for storage URLs
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS file_url TEXT;