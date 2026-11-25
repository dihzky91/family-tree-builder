-- Migration: Automatic branch submission counters & security hardening
-- Keeps submission_count and approved_count accurate without client-side race conditions or anon UPDATE permissions

CREATE OR REPLACE FUNCTION public.recalculate_branch_submission_counts(p_branch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_branch_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.branches
  SET
    submission_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.submissions
      WHERE branch_id = p_branch_id
    ),
    approved_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.submissions
      WHERE branch_id = p_branch_id AND status = 'approved'
    )
  WHERE id = p_branch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_submission_counts_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_branch_submission_counts(OLD.branch_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalculate_branch_submission_counts(NEW.branch_id);
    IF OLD.branch_id IS DISTINCT FROM NEW.branch_id THEN
      PERFORM public.recalculate_branch_submission_counts(OLD.branch_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recalculate_branch_submission_counts(NEW.branch_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_counts ON public.submissions;
CREATE TRIGGER trg_submissions_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_submission_counts_change();
