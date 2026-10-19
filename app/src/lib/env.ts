/**
 * Public configuration. EXPO_PUBLIC_* values are bundled into the app, so only
 * put keys here that are safe to ship (the Supabase anon key and the PostHog
 * project key are designed for that). Service keys belong in Supabase secrets.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isPosthogConfigured = Boolean(env.posthogKey);
