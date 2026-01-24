-- Add file_path column for storing the storage path
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS file_path TEXT;