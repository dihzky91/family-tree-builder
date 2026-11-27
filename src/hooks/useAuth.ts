import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
}

// Module-level shared auth cache so multiple components calling useAuth()
// (AuthGuard, UserMenu, FamilyView, ProfilePage) don't trigger duplicate network fetches.
let cachedAuthState: AuthState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
};
let authInitialized = false;
let inFlightProfilePromise: Promise<Profile | null> | null = null;
let inFlightProfileUserId: string | null = null;
const authSubscribers = new Set<(state: AuthState) => void>();

function notifyAuthSubscribers(next: AuthState) {
  cachedAuthState = next;
  authSubscribers.forEach((listener) => listener(next));
}

async function fetchProfileOnce(userId: string, force = false): Promise<Profile | null> {
  if (!force && cachedAuthState.profile?.user_id === userId) {
    return cachedAuthState.profile;
  }
  if (!force && inFlightProfilePromise && inFlightProfileUserId === userId) {
    return inFlightProfilePromise;
  }

  inFlightProfileUserId = userId;
  const supabase = getSupabaseClient();
  inFlightProfilePromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (!error && data) {
        const profile = data as Profile;
        notifyAuthSubscribers({ ...cachedAuthState, profile });
        return profile;
      }
      return null;
    } finally {
      inFlightProfilePromise = null;
    }
  })();

  return inFlightProfilePromise;
}

function ensureAuthSubscription(hasSupabaseConfig: boolean) {
  if (authInitialized) return;
  authInitialized = true;

  if (!hasSupabaseConfig) {
    notifyAuthSubscribers({ ...cachedAuthState, isLoading: false });
    return;
  }

  const supabase = getSupabaseClient();

  supabase.auth.onAuthStateChange((_event, session) => {
    const nextUser = session?.user ?? null;
    const keepProfile =
      nextUser && cachedAuthState.profile?.user_id === nextUser.id
        ? cachedAuthState.profile
        : null;

    notifyAuthSubscribers({
      ...cachedAuthState,
      session,
      user: nextUser,
      profile: keepProfile,
      isLoading: false,
    });

    if (nextUser) {
      setTimeout(() => {
        void fetchProfileOnce(nextUser.id);
      }, 0);
    }
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    const nextUser = session?.user ?? null;
    const keepProfile =
      nextUser && cachedAuthState.profile?.user_id === nextUser.id
        ? cachedAuthState.profile
        : null;

    notifyAuthSubscribers({
      ...cachedAuthState,
      session,
      user: nextUser,
      profile: keepProfile,
      isLoading: false,
    });

    if (nextUser) {
      void fetchProfileOnce(nextUser.id);
    }
  });
}

function getAuthRedirectBaseUrl() {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return window.location.origin;
}

export function useAuth() {
  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  const [state, setState] = useState<AuthState>(() => {
    if (!hasSupabaseConfig) {
      return { user: null, session: null, profile: null, isLoading: false };
    }
    return cachedAuthState;
  });

  useEffect(() => {
    ensureAuthSubscription(hasSupabaseConfig);
    setState(cachedAuthState);
    authSubscribers.add(setState);
    return () => {
      authSubscribers.delete(setState);
    };
  }, [hasSupabaseConfig]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured') };
    }
    const supabase = getSupabaseClient();
    const redirectUrl = `${getAuthRedirectBaseUrl()}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: displayName,
        },
      },
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured') };
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { data, error };
  };

  const requestPasswordReset = async (email: string) => {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    const supabase = getSupabaseClient();
    const redirectUrl = `${getAuthRedirectBaseUrl()}/auth`;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    return { data, error };
  };

  const updatePassword = async (password: string) => {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({ password });

    return { data, error };
  };

  const signOut = async () => {
    if (!hasSupabaseConfig) {
      return { error: new Error('Supabase is not configured') };
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => {
    if (!hasSupabaseConfig) {
      return { error: new Error('Supabase is not configured') };
    }
    if (!state.user) return { error: new Error('No user logged in') };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', state.user.id)
      .select()
      .single();

    if (!error && data) {
      notifyAuthSubscribers({ ...cachedAuthState, profile: data as Profile });
    }

    return { data, error };
  };

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    isLoading: state.isLoading,
    isAuthenticated: !!state.session,
    signUp,
    signIn,
    requestPasswordReset,
    updatePassword,
    signOut,
    updateProfile,
  };
}
