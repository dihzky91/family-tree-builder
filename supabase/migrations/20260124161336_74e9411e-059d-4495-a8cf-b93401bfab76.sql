-- Add location columns to persons table
ALTER TABLE public.persons ADD COLUMN birth_place TEXT;
ALTER TABLE public.persons ADD COLUMN death_place TEXT;
ALTER TABLE public.persons ADD COLUMN residence TEXT;