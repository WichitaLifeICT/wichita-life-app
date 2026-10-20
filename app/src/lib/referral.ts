import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { claimReferral } from '@/lib/member';

const KEY = 'wl.pendingReferral';
export const WEB_URL = 'https://wichita-life-app.netlify.app';

export function inviteLink(code: string) {
  return `${WEB_URL}/?ref=${code}`;
}

function codeFrom(url: string | null) {
  if (!url) return undefined;
  const ref = Linking.parse(url).queryParams?.ref;
  return typeof ref === 'string' && /^[A-Za-z2-9]{6}$/.test(ref) ? ref.toUpperCase() : undefined;
}

export async function getPendingReferral() {
  try {
    return (await AsyncStorage.getItem(KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function clearPendingReferral() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

/**
 * Remembers a friend's invite code from a link (…?ref=ABC123) and credits it once the
 * new member has signed in. Old accounts are ignored by the server.
 */
export function useReferralCapture() {
  const url = Linking.useLinkingURL();
  const { session, profile } = useAuth();

  useEffect(() => {
    const code = codeFrom(Platform.OS === 'web' ? window.location.href : url);
    if (code) AsyncStorage.setItem(KEY, code).catch(() => {});
  }, [url]);

  useEffect(() => {
    if (!session || !profile) return;
    getPendingReferral().then(async (code) => {
      if (!code || code === profile.referral_code) return clearPendingReferral();
      try {
        await claimReferral(code);
      } finally {
        await clearPendingReferral();
      }
    });
  }, [session, profile]);
}
