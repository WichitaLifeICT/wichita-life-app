// Server-side PostHog events (the app's own events come from the app). Uses the app's public project key,
// the same one the app and website ship with: it can only send events, not read anything.
const POSTHOG_KEY = 'phc_w3N7n3ku3tnsBfgyZKqfpUs9iSH7D7Stk6ZX5mTbWB6E';

export type ServerEvent = { event: string; distinct_id: string; properties?: Record<string, unknown> };

/** Sends events in batches. Never throws: analytics must not break the thing being measured. */
export async function capture(events: ServerEvent[]) {
  const timestamp = new Date().toISOString();
  for (let i = 0; i < events.length; i += 500) {
    try {
      await fetch('https://us.i.posthog.com/batch/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          batch: events.slice(i, i + 500).map((e) => ({
            event: e.event,
            distinct_id: e.distinct_id,
            timestamp,
            properties: { ...e.properties, distinct_id: e.distinct_id, source: 'server' },
          })),
        }),
      });
    } catch {
      // ignore
    }
  }
}
