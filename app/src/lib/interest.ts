/**
 * How many members are interested in each event (tapped "Interested", which also saves it and sets a
 * reminder). Anyone can see the number, never who. Event rows ask for their count as they appear;
 * asks made at the same moment go out as one request.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

const counts = new Map<string, number>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
let queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

async function flush() {
  timer = undefined;
  const ids = [...queued];
  queued = new Set();
  if (!ids.length || !supabase) return;
  ids.forEach((id) => pending.add(id));
  try {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase.rpc('event_interest_counts', { events: chunk });
      if (error) throw error;
      const found = new Map(((data ?? []) as { event_id: string; interested: number }[]).map((r) => [r.event_id, r.interested]));
      for (const id of chunk) counts.set(id, found.get(id) ?? 0);
    }
    notify();
  } catch {
    // The count is a nice extra: leave it off rather than show an error.
  } finally {
    ids.forEach((id) => pending.delete(id));
  }
}

function want(id: string, fresh: boolean) {
  if (!fresh && (counts.has(id) || pending.has(id))) return;
  queued.add(id);
  timer ??= setTimeout(flush, 30);
}

/** How many members are interested in an event, once known. `fresh` asks again (the event page does). */
export function useInterestCount(eventId: string, fresh = false): number | undefined {
  useEffect(() => want(eventId, fresh), [eventId, fresh]);
  const get = () => counts.get(eventId);
  return useSyncExternalStore(subscribe, get, get);
}

/** Your own tap counts right away. */
export function bumpInterest(eventId: string, by: 1 | -1) {
  const n = counts.get(eventId);
  if (n === undefined) return;
  counts.set(eventId, Math.max(0, n + by));
  notify();
}

export const interestedLabel = (n: number) => `${n} ${n === 1 ? 'person' : 'people'} interested`;
