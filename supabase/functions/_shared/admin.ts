import { createClient } from 'npm:@supabase/supabase-js@2';

/** Service-role client. Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to every function. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/**
 * Scheduled jobs send `x-cron-secret`. The secret lives in Supabase Vault and is checked
 * by public.verify_cron_secret(), which only the service role can call.
 */
export async function isCronRequest(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret) return false;
  const { data, error } = await adminClient().rpc('verify_cron_secret', { secret });
  return !error && data === true;
}

// The admin site calls send-push from the browser, so responses allow cross-origin requests.
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
