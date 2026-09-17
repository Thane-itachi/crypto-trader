import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, loadProfile } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (fields: Partial<Profile>) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadProfile(user.id).then(setProfile);
  }, [user]);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error ? error.message : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (fields: Partial<Profile>) => {
    if (!user) return { error: 'Not signed in' };
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id);
    if (!error) {
      setProfile((p) => (p ? { ...p, ...fields } : p));
    }
    return { error: error ? error.message : null };
  };

  return (
    <Ctx.Provider
      value={{ user, profile, loading, configured: isSupabaseConfigured, signUp, signIn, signOut, updateProfile }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ---- Theme (dark default, persisted) ----

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('ct-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ct-theme', theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  };
}
