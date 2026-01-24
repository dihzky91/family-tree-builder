-- Migration: Add branches and submissions tables for Family Contribution Form
-- This enables crowdsourced family data collection via public forms

-- Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  root_person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  coordinator_name TEXT NOT NULL,
  coordinator_email TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  submission_count INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT branches_code_format CHECK (code ~ '^[a-z0-9-]+$')
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  
  -- Submitter info
  submitted_by TEXT NOT NULL,
  submitter_email TEXT,
  
  -- Person data (to be created when approved)
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'unknown')),
  birth_date TEXT,
  birth_place TEXT,
  death_date TEXT,
  death_place TEXT,
  residence TEXT,
  photo_url TEXT,
  notes TEXT,
  
  -- Relationship info
  relation_to_branch TEXT NOT NULL CHECK (relation_to_branch IN ('child', 'grandchild', 'great-grandchild', 'other')),
  parent_name TEXT,
  
  -- Review status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  
  -- Link to created person (when approved)
  created_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  
  -- Duplicate detection
  possible_duplicate_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branches_code ON public.branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_root_person ON public.branches(root_person_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(is_active);

CREATE INDEX IF NOT EXISTS idx_submissions_branch ON public.submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_person ON public.submissions(created_person_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branches
-- Public can read active branches by code (for public form)
CREATE POLICY "Public can view active branches by code"
  ON public.branches FOR SELECT
  USING (is_active = true);

-- Authenticated users (admins) can do everything with branches
CREATE POLICY "Authenticated users can manage branches"
  ON public.branches FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for submissions
-- Public can insert submissions (for public form)
CREATE POLICY "Public can create submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (true);

-- Public can read approved submissions (for showing approved members on form)
CREATE POLICY "Public can view approved submissions"
  ON public.submissions FOR SELECT
  USING (status = 'approved');

-- Authenticated users (admins) can do everything with submissions
CREATE POLICY "Authenticated users can manage submissions"
  ON public.submissions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE public.branches IS 'Family branches for crowdsourced data collection. Each branch has unique public form URL.';
COMMENT ON TABLE public.submissions IS 'Public form submissions awaiting admin review and approval.';

COMMENT ON COLUMN public.branches.code IS 'URL-safe code for public form link, e.g., "family-budi"';
COMMENT ON COLUMN public.branches.root_person_id IS 'Person ID of branch head/coordinator';
COMMENT ON COLUMN public.submissions.relation_to_branch IS 'Relationship to branch root person';
COMMENT ON COLUMN public.submissions.created_person_id IS 'Person ID created after approval (links submission to person)';
