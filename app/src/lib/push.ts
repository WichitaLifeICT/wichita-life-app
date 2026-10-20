import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { posthog } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Show notifications that arrive while the app is open, too.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Saves this phone's push token to the signed-in account. Quietly does nothing if it can't. */
async function saveToken() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token, platform: Platform.OS as 'ios' | 'android' }, { onConflict: 'token' });
  } catch {
    // No push service on this build yet (for example Android without Firebase set up).
  }
}

/** Asks for permission (once) and registers this phone. Returns whether notifications are on. */
export async function enablePush(source: 'onboarding' | 'giveaway' | 'settings' | 'save_event'): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Wichita Life',
      importance: AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') status = (await Notifications.requestPermissionsAsync()).status;
  const granted = status === 'granted';
  posthog?.capture('notification_permission_result', { granted, source });
  if (granted) await saveToken();
  return granted;
}

/** Removes this phone's token when signing out, so the next person doesn't get your pushes. */
export async function forgetPushToken() {
  if (!supabase || Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {}
}

/**
 * Keeps the token fresh for signed-in members who already allowed notifications, and
 * opens the right screen when a notification is tapped (data.path, e.g. "/event/123").
 */
export function usePushNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    getPushPermission().then((p) => {
      if (p === 'granted') saveToken();
    });
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { path?: string; topic?: string } | undefined;
      if (!data) return;
      posthog?.capture('push_opened', { kind: data.topic ?? 'unknown', ...(data.path ? { target: data.path } : {}) });
      if (data.path) router.push(data.path as Href);
    };
    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
