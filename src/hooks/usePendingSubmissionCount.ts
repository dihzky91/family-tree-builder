import { useState, useEffect } from 'react';
import { getPendingSubmissionCount } from '@/storage/supabase/submissionQueries';
import { useFamilyStore } from '@/store/familyStore';

export const SUBMISSIONS_CHANGED_EVENT = 'silsilah:submissions-changed';

export function notifySubmissionsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUBMISSIONS_CHANGED_EVENT));
  }
}

export function usePendingSubmissionCount(): number {
  const { isDemoMode } = useFamilyStore();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isDemoMode) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await getPendingSubmissionCount();
        if (!cancelled) setCount(next);
      } catch {
        // Ignore network/offline errors
      }
    };

    void refresh();
    window.addEventListener(SUBMISSIONS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(SUBMISSIONS_CHANGED_EVENT, refresh);
    };
  }, [isDemoMode]);

  return count;
}
