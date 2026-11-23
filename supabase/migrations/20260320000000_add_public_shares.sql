-- Migration: Add public_shares table for Read-Only Public Shareable Family Tree Links
-- Supports full-tree or branch-scoped links, optional PIN protection, and living-member privacy

CREATE TABLE IF NOT EXISTS public.public_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  scope_type TEXT NOT NULL DEFAULT 'full' CHECK (scope_type IN ('full', 'branch')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_code TEXT,
  branch_name TEXT,
  root_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  pin_code TEXT,
  hide_living_details BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  snapshot_data JSONB NOT NULL DEFAULT '{"persons": [], "relationships": []}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT public_shares_code_format CHECK (code ~ '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS idx_public_shares_code ON public.public_shares(code);
CREATE INDEX IF NOT EXISTS idx_public_shares_user_id ON public.public_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_public_shares_active ON public.public_shares(is_active);

CREATE TRIGGER set_public_shares_updated_at
  BEFORE UPDATE ON public.public_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.public_shares ENABLE ROW LEVEL SECURITY;

-- Authenticated owners can manage their own share links
CREATE POLICY "Authenticated users can manage public_shares"
  ON public.public_shares FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public RPC to check share metadata (without exposing snapshot_data or pin_code)
CREATE OR REPLACE FUNCTION public.get_public_share_meta(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.public_shares%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.public_shares
  WHERE code = p_code AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'title', v_row.title,
    'description', v_row.description,
    'scopeType', v_row.scope_type,
    'branchId', v_row.branch_id,
    'branchCode', v_row.branch_code,
    'branchName', v_row.branch_name,
    'rootPersonId', v_row.root_person_id,
    'hasPin', (v_row.pin_code IS NOT NULL AND length(trim(v_row.pin_code)) > 0),
    'hideLivingDetails', v_row.hide_living_details,
    'updatedAt', v_row.updated_at
  );
END;
$$;

-- Public RPC to verify PIN (if required) and return the snapshot payload
CREATE OR REPLACE FUNCTION public.unlock_public_share(p_code TEXT, p_pin TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.public_shares%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.public_shares
  WHERE code = p_code AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.pin_code IS NOT NULL AND length(trim(v_row.pin_code)) > 0 THEN
    IF p_pin IS NULL OR trim(p_pin) <> trim(v_row.pin_code) THEN
      RETURN jsonb_build_object('status', 'invalid_pin');
    END IF;
  END IF;

  UPDATE public.public_shares
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'payload', jsonb_build_object(
      'share', jsonb_build_object(
        'id', v_row.id,
        'code', v_row.code,
        'title', v_row.title,
        'description', v_row.description,
        'scopeType', v_row.scope_type,
        'branchId', v_row.branch_id,
        'branchCode', v_row.branch_code,
        'branchName', v_row.branch_name,
        'rootPersonId', v_row.root_person_id,
        'hideLivingDetails', v_row.hide_living_details,
        'updatedAt', v_row.updated_at
      ),
      'persons', COALESCE(v_row.snapshot_data->'persons', '[]'::jsonb),
      'relationships', COALESCE(v_row.snapshot_data->'relationships', '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_share_meta(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_public_share(TEXT, TEXT) TO anon, authenticated;
