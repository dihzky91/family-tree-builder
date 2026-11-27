-- Harden public data access, share PINs, audit integrity, and admin checks.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Public visitors must use narrowly scoped RPC/Edge Function interfaces.
DROP POLICY IF EXISTS "Public can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can view approved submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anonymous can view approved submissions" ON public.submissions;
REVOKE ALL ON TABLE public.submissions FROM anon;

DROP POLICY IF EXISTS "Public can view active branches by code" ON public.branches;
REVOKE ALL ON TABLE public.branches FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_branch(p_code TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'code', code,
    'name', name,
    'root_person_id', root_person_id,
    'coordinator_name', coordinator_name,
    'description', description,
    'is_active', is_active,
    'submission_count', submission_count,
    'approved_count', approved_count,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM public.branches
  WHERE code = lower(trim(p_code))
    AND is_active = true
    AND coordinator_name <> '__PUBLIC_SHARE__'
    AND COALESCE(description, '') NOT LIKE '__PUBLIC_SHARE_V1__:%'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_branch(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_branch(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_approved_members(p_branch_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'full_name', full_name,
    'relation_to_branch', relation_to_branch,
    'parent_name', parent_name,
    'created_person_id', created_person_id,
    'gender', gender,
    'has_birth_date', birth_date IS NOT NULL
  ) ORDER BY created_at), '[]'::jsonb)
  FROM public.submissions
  WHERE branch_id = p_branch_id AND status = 'approved';
$$;
REVOKE ALL ON FUNCTION public.get_approved_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_approved_members(UUID) TO anon, authenticated;

-- Audit entries can only represent the authenticated caller. System audit should use triggers.
DROP FUNCTION IF EXISTS public.create_audit_log(UUID, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_changes JSONB DEFAULT NULL
)
RETURNS public.audit_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result public.audit_logs;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF length(p_action) NOT BETWEEN 1 AND 64
     OR length(p_entity_type) NOT BETWEEN 1 AND 64
     OR length(p_entity_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'invalid audit event';
  END IF;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, changes, timestamp)
  VALUES (v_uid, p_action, p_entity_type, p_entity_id, p_changes, now())
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_audit_log(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_audit_log(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Dedicated user_roles table for explicit admin authorization (service_role managed)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Seed initial earliest user as admin if user_roles is empty so existing owner retains access
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  AND u.created_at = (SELECT min(u2.created_at) FROM auth.users u2)
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
    OR (
      NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
      AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
          AND u.created_at = (SELECT min(u2.created_at) FROM auth.users u2)
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Replace plaintext share PINs with bcrypt hashes.
ALTER TABLE public.public_shares ADD COLUMN IF NOT EXISTS pin_hash TEXT;
UPDATE public.public_shares
SET pin_hash = extensions.crypt(pin_code, extensions.gen_salt('bf', 12)), pin_code = NULL
WHERE NULLIF(trim(pin_code), '') IS NOT NULL AND pin_hash IS NULL;
UPDATE public.public_shares SET pin_code = NULL WHERE pin_code IS NOT NULL;

-- Migrate any legacy unencrypted public shares from branches.description into public_shares, then remove them from branches
INSERT INTO public.public_shares (
  id, code, title, description, scope_type, branch_id, branch_code, branch_name,
  root_person_id, pin_code, pin_hash, hide_living_details, is_active, view_count, snapshot_data, created_at, updated_at
)
SELECT
  b.id,
  b.code,
  COALESCE(NULLIF(trim((substr(b.description, 21)::jsonb)->>'title'), ''), b.name),
  NULLIF(trim((substr(b.description, 21)::jsonb)->>'description'), ''),
  CASE WHEN ((substr(b.description, 21)::jsonb)->>'scopeType') = 'branch' THEN 'branch' ELSE 'full' END,
  NULLIF((substr(b.description, 21)::jsonb)->>'branchId', '')::UUID,
  NULLIF((substr(b.description, 21)::jsonb)->>'branchCode', ''),
  NULLIF((substr(b.description, 21)::jsonb)->>'branchName', ''),
  b.root_person_id,
  NULL,
  CASE
    WHEN NULLIF(trim((substr(b.description, 21)::jsonb)->>'pinCode'), '') IS NOT NULL
    THEN extensions.crypt(trim((substr(b.description, 21)::jsonb)->>'pinCode'), extensions.gen_salt('bf', 12))
    ELSE NULL
  END,
  COALESCE(((substr(b.description, 21)::jsonb)->>'hideLivingDetails')::BOOLEAN, false),
  COALESCE(b.is_active, true),
  COALESCE(b.submission_count, 0),
  COALESCE((substr(b.description, 21)::jsonb)->'snapshotData', '{"persons":[],"relationships":[]}'::jsonb),
  COALESCE(b.created_at, now()),
  COALESCE(b.updated_at, now())
FROM public.branches b
WHERE b.description LIKE '__PUBLIC_SHARE_V1__:%'
  AND ((substr(b.description, 21)::jsonb)->'encryptedSnapshot') IS NULL
ON CONFLICT (code) DO NOTHING;

DELETE FROM public.branches
WHERE coordinator_name = '__PUBLIC_SHARE__'
   OR description LIKE '__PUBLIC_SHARE_V1__:%';

CREATE OR REPLACE FUNCTION public.list_my_public_shares()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'code', code,
    'title', title,
    'description', description,
    'scope_type', scope_type,
    'branch_id', branch_id,
    'branch_code', branch_code,
    'branch_name', branch_name,
    'root_person_id', root_person_id,
    'has_pin', pin_hash IS NOT NULL,
    'hide_living_details', hide_living_details,
    'is_active', is_active,
    'view_count', view_count,
    'snapshot_persons_count', jsonb_array_length(COALESCE(snapshot_data->'persons', '[]'::jsonb)),
    'created_at', created_at,
    'updated_at', updated_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  FROM public.public_shares
  WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.list_my_public_shares() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_public_shares() TO authenticated;

CREATE OR REPLACE FUNCTION public.find_public_share_for_branch(
  p_branch_code TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'code', s.code,
    'title', s.title,
    'scopeType', s.scope_type,
    'hasPin', s.pin_hash IS NOT NULL
  )
  FROM public.public_shares s
  WHERE s.is_active = true
    AND (
      s.code = 'pohon-' || lower(trim(COALESCE(p_branch_code, '')))
      OR (p_branch_id IS NOT NULL AND s.branch_id = p_branch_id)
      OR (NULLIF(trim(COALESCE(p_branch_code, '')), '') IS NOT NULL AND lower(s.branch_code) = lower(trim(p_branch_code)))
      OR s.scope_type = 'full'
    )
  ORDER BY
    CASE
      WHEN s.code = 'pohon-' || lower(trim(COALESCE(p_branch_code, ''))) THEN 0
      WHEN p_branch_id IS NOT NULL AND s.branch_id = p_branch_id THEN 1
      WHEN NULLIF(trim(COALESCE(p_branch_code, '')), '') IS NOT NULL AND lower(s.branch_code) = lower(trim(p_branch_code)) THEN 2
      WHEN s.scope_type = 'full' THEN 3
      ELSE 4
    END,
    s.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_public_share_for_branch(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_public_share_for_branch(TEXT, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_public_share(
  p_id UUID,
  p_code TEXT,
  p_title TEXT,
  p_description TEXT,
  p_scope_type TEXT,
  p_branch_id UUID,
  p_branch_code TEXT,
  p_branch_name TEXT,
  p_root_person_id UUID,
  p_pin TEXT,
  p_preserve_pin BOOLEAN,
  p_hide_living_details BOOLEAN,
  p_is_active BOOLEAN,
  p_snapshot_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.public_shares%ROWTYPE;
  v_hash TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_code !~ '^[a-z0-9-]{4,64}$' OR length(trim(p_title)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid share code or title';
  END IF;
  IF p_scope_type NOT IN ('full', 'branch') OR pg_column_size(p_snapshot_data) > 5242880 THEN
    RAISE EXCEPTION 'invalid share payload';
  END IF;
  IF NULLIF(trim(p_pin), '') IS NOT NULL AND length(trim(p_pin)) < 8 THEN
    RAISE EXCEPTION 'PIN must contain at least 8 characters';
  END IF;

  SELECT * INTO v_row FROM public.public_shares WHERE id = p_id;
  IF FOUND AND v_row.user_id <> v_uid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  IF NULLIF(trim(p_pin), '') IS NOT NULL THEN
    v_hash := extensions.crypt(trim(p_pin), extensions.gen_salt('bf', 12));
  ELSIF p_preserve_pin AND FOUND THEN
    v_hash := v_row.pin_hash;
  ELSE
    v_hash := NULL;
  END IF;

  INSERT INTO public.public_shares (
    id, user_id, code, title, description, scope_type, branch_id, branch_code,
    branch_name, root_person_id, pin_code, pin_hash, hide_living_details,
    is_active, snapshot_data
  ) VALUES (
    p_id, v_uid, lower(trim(p_code)), trim(p_title), NULLIF(trim(p_description), ''),
    p_scope_type, p_branch_id, NULLIF(trim(p_branch_code), ''), NULLIF(trim(p_branch_name), ''),
    p_root_person_id, NULL, v_hash, p_hide_living_details, p_is_active, p_snapshot_data
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code, title = EXCLUDED.title, description = EXCLUDED.description,
    scope_type = EXCLUDED.scope_type, branch_id = EXCLUDED.branch_id,
    branch_code = EXCLUDED.branch_code, branch_name = EXCLUDED.branch_name,
    root_person_id = EXCLUDED.root_person_id, pin_code = NULL, pin_hash = EXCLUDED.pin_hash,
    hide_living_details = EXCLUDED.hide_living_details, is_active = EXCLUDED.is_active,
    snapshot_data = EXCLUDED.snapshot_data
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id, 'code', v_row.code, 'title', v_row.title,
    'description', v_row.description, 'scope_type', v_row.scope_type,
    'branch_id', v_row.branch_id, 'branch_code', v_row.branch_code,
    'branch_name', v_row.branch_name, 'root_person_id', v_row.root_person_id,
    'has_pin', v_row.pin_hash IS NOT NULL, 'hide_living_details', v_row.hide_living_details,
    'is_active', v_row.is_active, 'view_count', v_row.view_count,
    'snapshot_persons_count', jsonb_array_length(COALESCE(v_row.snapshot_data->'persons', '[]'::jsonb)),
    'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.save_public_share(UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,UUID,TEXT,BOOLEAN,BOOLEAN,BOOLEAN,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_public_share(UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,UUID,TEXT,BOOLEAN,BOOLEAN,BOOLEAN,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_share_meta(p_code TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', id, 'code', code, 'title', title, 'description', description,
    'scopeType', scope_type, 'branchId', branch_id, 'branchCode', branch_code,
    'branchName', branch_name, 'rootPersonId', root_person_id,
    'hasPin', pin_hash IS NOT NULL, 'hideLivingDetails', hide_living_details,
    'updatedAt', updated_at
  )
  FROM public.public_shares
  WHERE code = lower(trim(p_code)) AND is_active = true LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_share_meta(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_share_meta(TEXT) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.public_share_attempts (
  share_id UUID NOT NULL REFERENCES public.public_shares(id) ON DELETE CASCADE,
  client_hash TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  PRIMARY KEY (share_id, client_hash)
);
ALTER TABLE public.public_share_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_share_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.unlock_public_share_internal(
  p_code TEXT,
  p_pin TEXT,
  p_client_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_row public.public_shares%ROWTYPE;
  v_attempt public.public_share_attempts%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_row FROM public.public_shares
  WHERE code = lower(trim(p_code)) AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

  IF v_row.pin_hash IS NOT NULL THEN
    INSERT INTO public.public_share_attempts(share_id, client_hash)
    VALUES (v_row.id, p_client_hash)
    ON CONFLICT (share_id, client_hash) DO NOTHING;
    SELECT * INTO v_attempt FROM public.public_share_attempts
    WHERE share_id = v_row.id AND client_hash = p_client_hash FOR UPDATE;

    IF v_attempt.window_started_at < v_now - interval '15 minutes' THEN
      UPDATE public.public_share_attempts SET attempts = 0, window_started_at = v_now, locked_until = NULL
      WHERE share_id = v_row.id AND client_hash = p_client_hash;
      v_attempt.attempts := 0; v_attempt.locked_until := NULL;
    END IF;
    IF v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > v_now THEN
      RETURN jsonb_build_object('status', 'rate_limited', 'retryAfter', ceil(extract(epoch FROM (v_attempt.locked_until-v_now))));
    END IF;
    IF p_pin IS NULL OR extensions.crypt(trim(p_pin), v_row.pin_hash) <> v_row.pin_hash THEN
      UPDATE public.public_share_attempts SET
        attempts = attempts + 1,
        locked_until = CASE WHEN attempts + 1 >= 5 THEN v_now + interval '15 minutes' ELSE NULL END
      WHERE share_id = v_row.id AND client_hash = p_client_hash;
      RETURN jsonb_build_object('status', 'invalid_pin');
    END IF;
    DELETE FROM public.public_share_attempts WHERE share_id = v_row.id AND client_hash = p_client_hash;
  END IF;

  UPDATE public.public_shares SET view_count = view_count + 1 WHERE id = v_row.id;
  RETURN jsonb_build_object('status', 'ok', 'payload', jsonb_build_object(
    'share', jsonb_build_object(
      'id', v_row.id, 'code', v_row.code, 'title', v_row.title,
      'description', v_row.description, 'scopeType', v_row.scope_type,
      'branchId', v_row.branch_id, 'branchCode', v_row.branch_code,
      'branchName', v_row.branch_name, 'rootPersonId', v_row.root_person_id,
      'hideLivingDetails', v_row.hide_living_details, 'updatedAt', v_row.updated_at
    ),
    'persons', COALESCE(v_row.snapshot_data->'persons', '[]'::jsonb),
    'relationships', COALESCE(v_row.snapshot_data->'relationships', '[]'::jsonb)
  ));
END;
$$;
DROP FUNCTION IF EXISTS public.unlock_public_share(TEXT, TEXT);
REVOKE ALL ON FUNCTION public.unlock_public_share_internal(TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_public_share_internal(TEXT,TEXT,TEXT) TO service_role;

-- The service-role Edge Function is the only public-submission writer.
CREATE TABLE IF NOT EXISTS public.public_submission_limits (
  client_hash TEXT NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_hash, branch_id)
);
ALTER TABLE public.public_submission_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_submission_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_public_submission_rate(p_client_hash TEXT, p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.public_submission_limits%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO public.public_submission_limits(client_hash, branch_id)
  VALUES (p_client_hash, p_branch_id)
  ON CONFLICT (client_hash, branch_id) DO NOTHING;
  SELECT * INTO v_row FROM public.public_submission_limits
  WHERE client_hash = p_client_hash AND branch_id = p_branch_id FOR UPDATE;
  IF v_row.window_started_at < v_now - interval '1 hour' THEN
    UPDATE public.public_submission_limits
    SET attempts = 1, window_started_at = v_now
    WHERE client_hash = p_client_hash AND branch_id = p_branch_id;
    RETURN jsonb_build_object('allowed', true, 'remaining', 4);
  END IF;
  IF v_row.attempts >= 5 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retryAfter', ceil(extract(epoch FROM (v_row.window_started_at + interval '1 hour' - v_now)))
    );
  END IF;
  UPDATE public.public_submission_limits SET attempts = attempts + 1
  WHERE client_hash = p_client_hash AND branch_id = p_branch_id;
  RETURN jsonb_build_object('allowed', true, 'remaining', 4 - v_row.attempts);
END;
$$;
REVOKE ALL ON FUNCTION public.check_public_submission_rate(TEXT,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate(TEXT,UUID) TO service_role;

GRANT INSERT ON public.submissions TO service_role;
GRANT SELECT ON public.branches TO service_role;
