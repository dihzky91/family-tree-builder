import { useState, useEffect } from 'react';
import { getPendingSubmissionCount } from '@/storage/supabase/submissionQueries';
import { useFamilyStore } from '@/store/familyStore';

export const SUBMISSIONS_CHANGED_EVENT = 'silsilah:submissions-changed';

export function notifySubmissionsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUBMISSIONS_CHANGED_EVENT));
  }
}

let cachedSubmissionCount = 0;
let inFlightCountPromise: Promise<number> | null = null;
let lastCountFetchedAt = 0;

export function usePendingSubmissionCount(): number {
  const { isDemoMode } = useFamilyStore();
  const [count, setCount] = useState(cachedSubmissionCount);

  useEffect(() => {
    if (isDemoMode) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const refresh = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCountFetchedAt < 15_000 && inFlightCountPromise === null && lastCountFetchedAt > 0) {
        if (!cancelled) setCount(cachedSubmissionCount);
        return;
      }
      try {
        if (!inFlightCountPromise) {
          inFlightCountPromise = getPendingSubmissionCount().finally(() => {
            inFlightCountPromise = null;
          });
        }
        const next = await inFlightCountPromise;
        cachedSubmissionCount = next;
        lastCountFetchedAt = Date.now();
        if (!cancelled) setCount(next);
      } catch {
        // Ignore network/offline errors
      }
    };

    void refresh(false);
    const onChanged = () => { void refresh(true); };
    window.addEventListener(SUBMISSIONS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(SUBMISSIONS_CHANGED_EVENT, onChanged);
    };
  }, [isDemoMode]);

  return count;
}
