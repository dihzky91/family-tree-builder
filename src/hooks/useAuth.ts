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

export function useAuth() {
  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      setState(prev => ({ ...prev, profile: data as Profile }));
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const supabase = getSupabaseClient();
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false,
        }));

        // Defer profile fetch with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setState(prev => ({ ...prev, profile: null }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));

      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, hasSupabaseConfig]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!hasSupabaseConfig) {
      return { data: null, error: new Error('Supabase is not configured') };
    }
    const supabase = getSupabaseClient();
    const redirectUrl = `${window.location.origin}/`;
    
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
    const redirectUrl = `${window.location.origin}/auth`;

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
      setState(prev => ({ ...prev, profile: data as Profile }));
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
