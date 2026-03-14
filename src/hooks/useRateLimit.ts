import { useState, useEffect, useCallback } from 'react';

interface RateLimitState {
  attempts: number;
  lockedUntil: number | null;
  isLocked: boolean;
}

const RATE_LIMIT_KEY = 'login_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function useRateLimit(identifier: string = 'default') {
  const [state, setState] = useState<RateLimitState>({
    attempts: 0,
    lockedUntil: null,
    isLocked: false,
  });

  // Load rate limit state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${RATE_LIMIT_KEY}_${identifier}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        
        // Check if lock has expired
        if (parsed.lockedUntil && parsed.lockedUntil > now) {
          setState({
            attempts: parsed.attempts,
            lockedUntil: parsed.lockedUntil,
            isLocked: true,
          });
        } else {
          // Lock expired, reset
          setState({ attempts: 0, lockedUntil: null, isLocked: false });
          localStorage.removeItem(`${RATE_LIMIT_KEY}_${identifier}`);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [identifier]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (state.attempts > 0 || state.lockedUntil) {
      try {
        localStorage.setItem(`${RATE_LIMIT_KEY}_${identifier}`, JSON.stringify({
          attempts: state.attempts,
          lockedUntil: state.lockedUntil,
        }));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [state, identifier]);

  const recordAttempt = useCallback(() => {
    setState(prev => {
      const newAttempts = prev.attempts + 1;
      
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCK_DURATION_MS;
        return {
          attempts: newAttempts,
          lockedUntil,
          isLocked: true,
        };
      }
      
      return {
        ...prev,
        attempts: newAttempts,
        isLocked: false,
      };
    });
  }, []);

  const resetAttempts = useCallback(() => {
    setState({ attempts: 0, lockedUntil: null, isLocked: false });
    try {
      localStorage.removeItem(`${RATE_LIMIT_KEY}_${identifier}`);
    } catch {
      // Ignore localStorage errors
    }
  }, [identifier]);

  const getRemainingTime = useCallback(() => {
    if (!state.lockedUntil) return 0;
    const remaining = state.lockedUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }, [state.lockedUntil]);

  const formatRemainingTime = useCallback(() => {
    const remaining = getRemainingTime();
    if (remaining <= 0) return '';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes} menit ${seconds} detik`;
    }
    return `${seconds} detik`;
  }, [getRemainingTime]);

  return {
    attempts: state.attempts,
    isLocked: state.isLocked,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - state.attempts),
    recordAttempt,
    resetAttempts,
    getRemainingTime,
    formatRemainingTime,
  };
}
