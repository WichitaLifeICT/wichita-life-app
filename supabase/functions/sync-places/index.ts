// Pulls places to eat in Wichita from OpenStreetMap into public.places, for "Where should I eat?".
// Runs monthly. New places are added; for ones we have, only map details (name, address, cuisine,
// website, hours) are refreshed, never what staff set (status, chain, local pick, note).

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { chainNames, OVERPASS_QUERY, OVERPASS_SERVERS, parseOverpass } from '../_shared/places.ts';

const UA = 'WichitaLifeApp/1.0 (+https://wichitalifeict.com)';

/** Overpass servers are often busy; try each in turn. */
async function overpass() {
  const errors: string[] = [];
  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: new URLSearchParams({ data: OVERPASS_QUERY }),
        signal: AbortSignal.timeout(100_000),
      });
      if (res.ok) {
        const body = await res.json();
        // A busy server can answer 200 with a "remark" saying the query was cut off.
        if (body.remark && !body.elements?.length) errors.push(`${new URL(server).host}: ${body.remark}`);
        else return body;
        continue;
      }
      errors.push(`${new URL(server).host}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${new URL(server).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join('; '));
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);

  let rows;
  try {
    rows = parseOverpass(await overpass());
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
  // A near-empty answer is more likely a bad response than the city running out of restaurants.
  if (rows.length < 100) return json({ error: `Only ${rows.length} places came back; not updating` }, 502);

  const db = adminClient();
  const { data: existing, error: readErr } = await db.from('places').select('osm_id, name, chain');
  if (readErr) return json({ error: readErr.message }, 500);
  const known = new Set((existing ?? []).filter((r) => r.osm_id).map((r) => r.osm_id));
  // Names staff already marked local (Wichita-born chains like Spangles) stay local at new locations too.
  const local = new Set((existing ?? []).filter((r) => !r.chain).map((r) => r.name.toLowerCase()));
  const chains = chainNames(rows);
  const now = new Date().toISOString();

  const mapDetails = ({ branded: _b, ...r }: (typeof rows)[number]) => ({ ...r, synced_at: now });
  const fresh = rows
    .filter((r) => !known.has(r.osm_id))
    // National chains start hidden: the app is for local spots. Staff can show one in Staff tools → Places.
    .map((r) => {
      const chain = !local.has(r.name.toLowerCase()) && (r.branded || chains.has(r.name.toLowerCase()));
      return { ...mapDetails(r), chain, status: chain ? 'hidden' : 'active', source: 'osm' };
    });
  const updates = rows.filter((r) => known.has(r.osm_id)).map(mapDetails);

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await db.from('places').insert(fresh.slice(i, i + 500));
    if (error) return json({ error: error.message }, 500);
  }
  for (let i = 0; i < updates.length; i += 500) {
    const { error } = await db.from('places').upsert(updates.slice(i, i + 500), { onConflict: 'osm_id' });
    if (error) return json({ error: error.message }, 500);
  }

  // Places that dropped off the map may have closed. Don't hide them automatically; report the count.
  const seen = new Set(rows.map((r) => r.osm_id));
  const gone = [...known].filter((id) => !seen.has(id)).length;
  return json({ places: rows.length, added: fresh.length, updated: updates.length, missing_from_map: gone });
});
