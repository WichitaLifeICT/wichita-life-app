import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type FeedbackKind = 'idea' | 'bug' | 'love' | 'other';

/** Anyone can send feedback; signed-in members are linked to it. Only staff can read it. */
export async function sendFeedback(input: { kind: FeedbackKind; message: string; contactEmail?: string; screen?: string }) {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase.from('feedback').insert({
    user_id: data.session?.user.id ?? null,
    kind: input.kind,
    message: input.message.trim(),
    contact_email: input.contactEmail?.trim() || null,
    screen: input.screen ?? null,
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw new Error(error.message);
}
