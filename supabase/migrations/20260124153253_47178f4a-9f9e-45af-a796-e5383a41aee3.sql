-- Create persons table
CREATE TABLE public.persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'unknown')),
  birth_date TEXT,
  death_date TEXT,
  photo_url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create relationships table
CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PARENT_CHILD', 'SPOUSE')),
  from_person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  to_person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('married', 'divorced', 'partner', 'unknown')),
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create evidence table
CREATE TABLE public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('PERSON', 'RELATIONSHIP')),
  entity_id UUID NOT NULL,
  file_data TEXT,
  file_name TEXT,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('birth_certificate', 'family_card', 'marriage_certificate', 'death_certificate', 'photo', 'other')),
  source TEXT,
  date TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'verified', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Persons policies
CREATE POLICY "Users can view their own persons"
ON public.persons FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own persons"
ON public.persons FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own persons"
ON public.persons FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own persons"
ON public.persons FOR DELETE
USING (auth.uid() = user_id);

-- Relationships policies
CREATE POLICY "Users can view their own relationships"
ON public.relationships FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own relationships"
ON public.relationships FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own relationships"
ON public.relationships FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own relationships"
ON public.relationships FOR DELETE
USING (auth.uid() = user_id);

-- Evidence policies
CREATE POLICY "Users can view their own evidence"
ON public.evidence FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evidence"
ON public.evidence FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evidence"
ON public.evidence FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evidence"
ON public.evidence FOR DELETE
USING (auth.uid() = user_id);

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_persons_user_id ON public.persons(user_id);
CREATE INDEX idx_relationships_user_id ON public.relationships(user_id);
CREATE INDEX idx_relationships_from_person ON public.relationships(from_person_id);
CREATE INDEX idx_relationships_to_person ON public.relationships(to_person_id);
CREATE INDEX idx_evidence_user_id ON public.evidence(user_id);
CREATE INDEX idx_evidence_entity ON public.evidence(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Create trigger for updated_at on persons
CREATE TRIGGER update_persons_updated_at
BEFORE UPDATE ON public.persons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on relationships
CREATE TRIGGER update_relationships_updated_at
BEFORE UPDATE ON public.relationships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();