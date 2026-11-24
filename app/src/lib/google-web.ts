import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Sign in with Google on the website, with Google's own button. Google's window then says it's signing
 * you in to app.wichitalifeict.com. The older redirect sign-in showed our database's address
 * (rbxmzybuduluzpvtgfil.supabase.co), which looks wrong to people. The button hands back a signed token that
 * Supabase checks, the same way the phone apps' Google sign-in works.
 *
 * Needs app.wichitalifeict.com in "Authorized JavaScript origins" on the Web client in Google Cloud
 * (Credentials), which it has. If Google's code can't load, the website falls back to the redirect sign-in.
 */
export const GOOGLE_WEB_CLIENT_ID = '687917274823-l1d8h4i42dognvqovjnl9b7v29f7d8gs.apps.googleusercontent.com';
const GOOGLE_BUTTON_ON = true;
const SITE_HOST = 'app.wichitalifeict.com';
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

type GoogleId = {
  initialize(config: Record<string, unknown>): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
};
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleId } } };

/** Google's button only works on the real site (Google checks the address). */
export function googleButtonAvailable(): boolean {
  return GOOGLE_BUTTON_ON && Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === SITE_HOST;
}

let script: Promise<GoogleId> | undefined;
function loadScript(): Promise<GoogleId> {
  script ??= new Promise<GoogleId>((resolve, reject) => {
    const w = window as GoogleWindow;
    if (w.google?.accounts?.id) return resolve(w.google.accounts.id);
    const tag = document.createElement('script');
    tag.src = SCRIPT_URL;
    tag.async = true;
    tag.onload = () => (w.google?.accounts?.id ? resolve(w.google.accounts.id) : reject(new Error('Google sign-in didn’t load.')));
    tag.onerror = () => reject(new Error('Google sign-in didn’t load.'));
    document.head.appendChild(tag);
  }).catch((e: Error) => {
    script = undefined;
    throw e;
  });
  return script;
}

export type GoogleWebResult = { idToken: string; nonce: string };
let onResult: ((r: GoogleWebResult) => void) | undefined;
let nonce = '';

/**
 * Loads Google's sign-in and draws its button into `el`. `handle` gets the signed token (and the unhashed
 * nonce Supabase needs) each time someone finishes signing in with it. Returns false if Google's code
 * couldn't load, so the page can show its own button instead.
 */
export async function renderGoogleButton(el: HTMLElement, width: number, dark: boolean, handle: (r: GoogleWebResult) => void): Promise<boolean> {
  if (!googleButtonAvailable()) return false;
  let id: GoogleId;
  try {
    id = await loadScript();
  } catch {
    return false;
  }
  onResult = handle;
  nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  id.initialize({
    client_id: GOOGLE_WEB_CLIENT_ID,
    nonce: hashed,
    ux_mode: 'popup',
    auto_select: false,
    itp_support: true,
    use_fedcm_for_button: true,
    callback: ({ credential }: { credential?: string }) => {
      if (credential && onResult) onResult({ idToken: credential, nonce });
    },
  });
  el.innerHTML = '';
  id.renderButton(el, {
    type: 'standard',
    theme: dark ? 'filled_black' : 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    width: Math.min(400, Math.max(200, Math.round(width))),
  });
  return true;
}
