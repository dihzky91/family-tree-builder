-- Migration: Fix audit_logs RLS to prevent users from creating their own audit logs
-- Audit logs should only be created by the system/database triggers

-- Drop existing insert policy for users
DROP POLICY IF EXISTS "Users can create their own audit logs" ON public.audit_logs;

-- Keep the select policy so users can view their own audit history
-- But remove the ability for users to insert audit logs directly

-- Create a security definer function for creating audit logs
-- This allows the system to create audit logs while bypassing RLS
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_changes JSONB DEFAULT NULL
)
RETURNS public.audit_logs AS $$
DECLARE
  v_result public.audit_logs;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    changes,
    timestamp
  ) VALUES (
    p_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_changes,
    NOW()
  )
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only allow insert through the security definer function
-- Regular users cannot insert directly
CREATE POLICY "Only system can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

COMMENT ON FUNCTION public.create_audit_log IS 'Security definer function to create audit logs. Use this instead of direct INSERT.';
