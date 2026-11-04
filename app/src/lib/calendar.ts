/**
 * Plans in the phone calendar, through the `calendar` function. Each member has a private link
 * (a secret token): with a plan id it's that plan as a calendar file to add once; without, it's a
 * live feed of their plans and saved events that calendar apps subscribe to and keep in sync.
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { shareLink } from '@/lib/share';
import { supabase } from '@/lib/supabase';

const BASE = `${env.supabaseUrl}/functions/v1/calendar`;

async function token(reset = false) {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data, error } = await supabase.rpc('my_calendar_token', { reset });
  if (error) throw error;
  return data as string;
}

/** Opens the plan as a calendar file: phones and computers offer "Add All" to the calendar. */
export async function addPlanToCalendar(planId: string) {
  await Linking.openURL(`${BASE}?t=${await token()}&plan=${planId}`);
}

/** The private feed link, for Google Calendar's "From URL" (or anything that takes a link). */
export async function calendarFeedLink() {
  return `${BASE}?t=${await token()}`;
}

/** Subscribes in the phone's (or Mac's) Calendar app, which then keeps it in sync on its own. */
export async function subscribeInCalendar() {
  const link = await calendarFeedLink();
  await Linking.openURL(link.replace(/^https:/, 'webcal:'));
}

/** Share or copy the feed link (Android and Google Calendar users paste it in Google Calendar). */
export async function shareCalendarLink() {
  return shareLink(await calendarFeedLink(), 'My Wichita Life calendar (keep this link private):');
}

/** A new link; calendars subscribed with the old one stop updating. */
export async function resetCalendarLink() {
  await token(true);
}

/** Apple's Calendar opens webcal links; Android phones usually can't, so they use Google Calendar. */
export const canSubscribeHere = Platform.OS === 'ios' || (Platform.OS === 'web' && /Mac|iPhone|iPad/.test(navigator.userAgent));
