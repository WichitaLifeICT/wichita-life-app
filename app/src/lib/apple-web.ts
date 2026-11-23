import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Sign in with Apple on the website (app.wichitalifeict.com). Apple's own sign-in window opens, sends back a
 * signed token, and Supabase checks it the same way it checks the iPhone app's. No secret key is involved.
 *
 * Needs, in Apple Developer: a Services ID (APPLE_WEB_CLIENT_ID) with Sign in with Apple on, the domain
 * app.wichitalifeict.com and the return URL below. In Supabase → Authentication → Providers → Apple, the
 * Services ID goes in Client IDs next to the app's bundle ID.
 */
export const APPLE_WEB_CLIENT_ID = 'com.wichitalifeict.web';
const APPLE_WEB_HOST = 'app.wichitalifeict.com';
const RETURN_URL = `https://${APPLE_WEB_HOST}/sign-in`;
const SCRIPT_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/** Off until the Services ID is set up in Apple Developer and Supabase; then the button shows on the website. */
const APPLE_WEB_ON = false;

type AppleSignInResponse = {
  authorization?: { id_token?: string; code?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};
type AppleIdAuth = {
  init(config: { clientId: string; scope: string; redirectURI: string; nonce: string; usePopup: boolean }): void;
  signIn(): Promise<AppleSignInResponse>;
};
type AppleWindow = Window & { AppleID?: { auth: AppleIdAuth } };

/** Apple's window only works on the real site (Apple checks the address), so the button shows only there. */
export function appleWebAvailable(): boolean {
  return APPLE_WEB_ON && Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === APPLE_WEB_HOST;
}

let script: Promise<AppleIdAuth> | undefined;
// The unhashed nonce for the next tap. Apple gets its hash up front, so tapping the button can open Apple's
// window right away (browsers block windows opened after a wait).
let armed: string | undefined;

function loadScript(): Promise<AppleIdAuth> {
  script ??= new Promise<AppleIdAuth>((resolve, reject) => {
    const w = window as AppleWindow;
    if (w.AppleID) return resolve(w.AppleID.auth);
    const tag = document.createElement('script');
    tag.src = SCRIPT_URL;
    tag.async = true;
    tag.onload = () => (w.AppleID ? resolve(w.AppleID.auth) : reject(new Error('Apple sign-in didn’t load.')));
    tag.onerror = () => reject(new Error('Apple sign-in didn’t load.'));
    document.head.appendChild(tag);
  }).catch((e: Error) => {
    script = undefined; // let a later visit to the page try again
    throw e;
  });
  return script;
}

async function arm(auth: AppleIdAuth) {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  auth.init({ clientId: APPLE_WEB_CLIENT_ID, scope: 'name email', redirectURI: RETURN_URL, nonce: hashed, usePopup: true });
  armed = nonce;
}

/** Loads Apple's sign-in code when the sign-in page opens, so the button works on the first tap. */
export async function prepareAppleWeb(): Promise<boolean> {
  if (!appleWebAvailable()) return false;
  const auth = await loadScript();
  if (!armed) await arm(auth);
  return true;
}

export type AppleWebResult = { idToken: string; nonce: string; name?: string } | undefined;

/**
 * Opens Apple's window. Call it straight from the tap (no waiting first) or the browser blocks the window.
 * Returns undefined if they closed it. The name comes only the first time someone signs in with Apple.
 */
export async function appleWebSignIn(): Promise<AppleWebResult> {
  const auth = (window as AppleWindow).AppleID?.auth;
  const nonce = armed;
  if (!auth || !nonce) {
    prepareAppleWeb().catch(() => {});
    throw new Error('Apple sign-in is still loading. Try again in a second.');
  }
  armed = undefined;
  let response: AppleSignInResponse;
  try {
    response = await auth.signIn();
  } catch (e) {
    const code = (e as { error?: string })?.error ?? '';
    if (/popup_closed_by_user|user_cancelled_authorize|user_trigger_new_signin_flow/.test(code)) return undefined;
    if (/popup_blocked/.test(code)) throw new Error('Your browser blocked Apple’s sign-in window. Allow pop-ups for this site and try again.');
    throw new Error(`Apple sign-in didn’t finish${code ? ` (${code})` : ''}. Please try again.`);
  } finally {
    arm(auth).catch(() => {}); // ready for another try
  }
  const idToken = response.authorization?.id_token;
  if (!idToken) throw new Error('Apple didn’t send a sign-in token. Please try again.');
  const { firstName, lastName } = response.user?.name ?? {};
  return { idToken, nonce, name: firstName ? `${firstName}${lastName ? ` ${lastName[0]}.` : ''}` : undefined };
}
