import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

import { posthog } from '@/lib/analytics';
import { errorMessage } from '@/lib/format';
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
  // Who is signed in right now. refreshProfile reads this, not a session captured in some older
  // render: Apple sign-in saves the name and refreshes before this screen has re-rendered.
  const userIdRef = useRef<string | undefined>(undefined);
  // Only the newest profile load may set the profile, so a slow older one can't overwrite it.
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async (userId: string | undefined): Promise<void> => {
    const seq = ++loadSeq.current;
    if (!supabase || !userId) return setProfile(null);
    const current = () => seq === loadSeq.current && userId === userIdRef.current;
    // A network blip keeps what's on screen and tries again (after 1s, 3s, 9s) instead of looking signed out.
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1000 * 3 ** (attempt - 1)));
      if (!current()) return;
      // Codes aren't readable from profiles (members can't see each other's), so they come from my_codes().
      const [{ data, error }, { data: codes }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, interests, role, onboarded_at, created_at').eq('id', userId).maybeSingle(),
        supabase.rpc('my_codes').maybeSingle<{ referral_code: string; friend_code: string }>(),
      ]);
      if (!current()) return;
      if (error) continue;
      setProfile(data ? { ...data, referral_code: codes?.referral_code ?? '', friend_code: codes?.friend_code ?? '' } : null);
      // Link this phone or browser to the member every time the app opens signed in (not only at
      // sign-in), so one person on three devices counts once. Staff and dev builds are marked so
      // they're left out of PostHog's "real users" numbers (Internal / Test users cohort).
      if (data) {
        posthog?.identify(userId, data.role !== 'member' || __DEV__ ? { $internal_or_test_user: true } : undefined);
      }
      return;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      userIdRef.current = next?.user.id;
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
      refreshProfile: () => loadProfile(userIdRef.current),
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

/**
 * The sign-in email also carries a code (Supabase sends 6 to 10 digits, per the project's setting), which works on
 * any device. The link only works in the app or browser that asked for it.
 */
export async function verifyEmailCode(email: string, code: string) {
  const { error } = await client().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
}

/**
 * Plain-English sign-in errors. The big one: a launch-day rush can hit the email limits (Supabase's emails-per-hour
 * setting, or the email service's daily cap), so point people at Google/Apple, which send no email.
 */
export function friendlyAuthError(message: string, status?: number): string {
  if (status === 429 || /rate limit|too many|over_email_send/i.test(message)) {
    return 'Lots of people are signing up right now. Use Continue with Google or Apple, or try the email code again in a few minutes.';
  }
  if (/only request this after|security purposes/i.test(message)) {
    return 'We just sent you a code. Check your email (and spam), or wait a minute and tap Resend.';
  }
  if (/expired or is invalid|invalid otp|token has expired/i.test(message)) {
    return "That code didn't work. Check the newest email and type the whole code, or tap Resend for a new one.";
  }
  if (/error sending|smtp|sending .*email/i.test(message)) {
    return "We couldn't send the email just now. Use Continue with Google or Apple, or try again in a few minutes.";
  }
  return message;
}

/**
 * Web only: why opening a sign-in link failed, if it did. When the link opens in a browser that didn't ask for it
 * (Gmail's built-in browser, say), Supabase quietly ignores it, so a link that leaves no session counts as that.
 */
export async function linkSignInError(linkHadCode: boolean): Promise<string | undefined> {
  const { error } = await client().auth.initialize();
  if (error) return error.message;
  if (!linkHadCode) return undefined;
  const { data } = await client().auth.getSession();
  return data.session ? undefined : 'PKCE code verifier not found';
}

/** Only a few staff-made accounts have passwords (like the App Store reviewer's); everyone else uses a code. */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

/** Sign in with Apple, iPhone only. Returns the name Apple shares (only on the very first sign-in). */
export async function signInWithApple(): Promise<string | undefined> {
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple didn’t send a sign-in token. Please try again.');
  const { error } = await client().auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce });
  if (error) throw error;
  const { givenName, familyName } = credential.fullName ?? {};
  return givenName ? `${givenName}${familyName ? ` ${familyName[0]}.` : ''}` : undefined;
}

// Google sign-in client IDs (public identifiers, not secrets). The web one is also what Supabase checks.
const GOOGLE_WEB_CLIENT_ID = '687917274823-l1d8h4i42dognvqovjnl9b7v29f7d8gs.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '687917274823-cubtjpvl2rlldk8c0qcpir74i5v0v9ag.apps.googleusercontent.com';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: GoogleSigninModule | null | undefined;

/**
 * Native Google sign-in (Google's own account sheet, no supabase.co page). App builds from 1.0.1 on include it;
 * older builds don't, and still get updates, so only load it when the phone actually has it.
 */
function nativeGoogle(): GoogleSigninModule | null {
  if (googleModule !== undefined) return googleModule;
  googleModule = null;
  if (Platform.OS === 'web') return null;
  try {
    if (!TurboModuleRegistry.get('RNGoogleSignin')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    mod.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
    googleModule = mod;
  } catch {
    googleModule = null;
  }
  return googleModule;
}

/** Returns true when it handled sign-in (or the person cancelled); false means fall back to the browser. */
async function signInWithGoogleNative(google: GoogleSigninModule): Promise<boolean> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return true; // they closed the Google sheet
    const token = response.data.idToken;
    if (!token) throw new Error('Google didn’t send a sign-in token. Please try again.');
    const { error } = await client().auth.signInWithIdToken({ provider: 'google', token });
    if (error) {
      // Supabase's Google settings not updated yet (client IDs / nonce check): use the browser instead.
      if (/nonce|audience|aud\b|client id|unacceptable/i.test(error.message)) return false;
      throw error;
    }
    return true;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return true;
      // Any other Google-side problem (no Play services, a misconfigured client, an SDK hiccup):
      // note it for us and let the browser sign-in take over, so nobody is stuck.
      posthog?.captureException(e, { handled_by: 'google_native_fallback', code: String(e.code) });
      return false;
    }
    throw e;
  }
}

export async function signInWithGoogle() {
  const google = nativeGoogle();
  if (google && (await signInWithGoogleNative(google))) return;
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
  const result = await openSignInWindow(data.url, redirectTo);
  if (result.type !== 'success') return;
  await finishSignIn(result.url);
}

/**
 * iPhones allow one sign-in window at a time. A window left open from an earlier tap (say the app went to the
 * background mid-sign-in) makes the next one fail with "Another web browser is already open", so close any
 * leftover first, and if it still collides, close it and try once more.
 */
function closeLeftoverSignInWindow() {
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    // nothing was open
  }
}

async function openSignInWindow(url: string, redirectTo: string) {
  if (Platform.OS === 'ios') closeLeftoverSignInWindow();
  try {
    return await WebBrowser.openAuthSessionAsync(url, redirectTo);
  } catch (e) {
    if (!/already open/i.test(errorMessage(e))) throw e;
    closeLeftoverSignInWindow();
    await new Promise((r) => setTimeout(r, 400));
    return await WebBrowser.openAuthSessionAsync(url, redirectTo);
  }
}

// One exchange per sign-in code. On Android the same return URL can reach both the sign-in window and
// the /auth-callback screen; the second caller waits for the first instead of racing it and failing.
const exchanges = new Map<string, Promise<void>>();

/** Exchanges the one-time code in a sign-in return URL for a session (phones only; web does this itself). */
export async function finishSignIn(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : undefined;
  const errorDescription =
    typeof queryParams?.error_description === 'string' ? queryParams.error_description : undefined;
  if (errorDescription) throw new Error(errorDescription);
  if (!code) return;
  let exchange = exchanges.get(code);
  if (!exchange) {
    exchange = (async () => {
      const { data: current } = await client().auth.getSession();
      if (current.session) return; // already handled by the other listener
      const { error } = await client().auth.exchangeCodeForSession(code);
      if (error) throw error;
    })();
    exchanges.set(code, exchange);
  }
  await exchange;
}

/** Signs out this device only; your other phones and browsers stay signed in. */
export async function signOut() {
  await client().auth.signOut({ scope: 'local' });
  // Forget the Google account choice too, so the next Google sign-in lets them pick an account.
  await nativeGoogle()?.GoogleSignin.signOut().catch(() => {});
}

export async function deleteAccount() {
  const { data, error } = await client().functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  if (!data?.deleted) throw new Error('Could not delete the account');
  await client().auth.signOut({ scope: 'local' });
}
