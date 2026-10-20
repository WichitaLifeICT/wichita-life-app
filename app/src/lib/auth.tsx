import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { posthog } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until the saved session (if any) has been read from storage. */
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!supabase || !userId) return setProfile(null);
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, interests, role, onboarded_at')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      // Profile reads go through Supabase too, so run them outside this callback.
      setTimeout(() => loadProfile(next?.user.id), 0);
      if (event === 'SIGNED_IN' && next) posthog?.identify(next.user.id);
      if (event === 'SIGNED_OUT') posthog?.reset();
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile: () => loadProfile(session?.user.id),
    }),
    [session, profile, loading, loadProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Returns a guard for member-only actions: runs nothing and opens sign-in when signed out. */
export function useRequireSignIn() {
  const { session } = useAuth();
  return useCallback(
    (reason: string) => {
      if (session) return true;
      router.push({ pathname: '/sign-in', params: { reason } });
      return false;
    },
    [session],
  );
}

/** Where sign-in links and Google send people back to. */
export function authRedirectUrl() {
  if (Platform.OS === 'web') return `${window.location.origin}/auth-callback`;
  return Linking.createURL('auth-callback');
}

function client() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  return supabase;
}

export async function sendEmailLink(email: string) {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw error;
}

/** The sign-in email also carries a 6-digit code, for opening it on another device. */
export async function verifyEmailCode(email: string, code: string) {
  const { error } = await client().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = authRedirectUrl();
  if (Platform.OS === 'web') {
    const { error } = await client().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return; // the page navigates to Google and comes back to /auth-callback
  }
  const { data, error } = await client().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  await finishSignIn(result.url);
}

/** Exchanges the one-time code in a sign-in return URL for a session (phones only; web does this itself). */
export async function finishSignIn(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : undefined;
  const errorDescription =
    typeof queryParams?.error_description === 'string' ? queryParams.error_description : undefined;
  if (errorDescription) throw new Error(errorDescription);
  if (!code) return;
  const { data: current } = await client().auth.getSession();
  if (current.session) return; // already handled by the other listener
  const { error } = await client().auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function signOut() {
  await client().auth.signOut();
}

export async function deleteAccount() {
  const { data, error } = await client().functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  if (!data?.deleted) throw new Error('Could not delete the account');
  await client().auth.signOut({ scope: 'local' });
}
