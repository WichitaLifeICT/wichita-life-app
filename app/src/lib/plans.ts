/**
 * Plans: a member's itineraries ("This weekend", "Mom's visit"). Items are events, weekly
 * specials, places to eat, meetups or notes. A plan is private until its owner shares it; the
 * link (app.wichitalifeict.com/p/<code>) shows it read-only to anyone, in the app or on the web.
 * Dates are Wichita dates as "YYYY-MM-DD" keys.
 */
import { dayKey } from '@/lib/format';
import { WEB_URL } from '@/lib/referral';
import { shareLink } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { DAY_LONG, wichitaNow } from '@/lib/weekly';

export type PlanItemKind = 'event' | 'special' | 'place' | 'meetup' | 'note';

export type Plan = {
  id: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  share_code: string | null;
  updated_at: string;
  items: number;
};

type Ref = {
  title: string;
  starts_at?: string;
  ends_at?: string | null;
  all_day?: boolean;
  time_tbd?: boolean;
  venue?: string | null;
  address?: string | null;
  area?: string;
  kind?: string;
  days?: number[];
  starts?: string | null;
  ends?: string | null;
  website?: string | null;
  cuisine?: string[];
};

export type PlanItem = {
  id: string;
  kind: PlanItemKind;
  ref_id: string | null;
  on_date: string | null;
  at_time: string | null;
  note: string | null;
  /** What the item points at; null when it was removed or hidden. */
  ref: Ref | null;
};

export type PlanDetail = {
  id: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  mine: boolean;
  share_code: string | null;
  owner_name: string | null;
  items: PlanItem[];
};

function db() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  return supabase;
}

// --- Dates --------------------------------------------------------------------------------

const noon = (key: string) => new Date(`${key}T12:00:00Z`);
export const todayKey = (now = new Date()) => dayKey(now.toISOString());
export const addDays = (key: string, n: number) => new Date(noon(key).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (key: string) => noon(key).getUTCDay();
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

/** "Saturday, Nov 7" */
export const dayTitle = (key: string) => dayFmt.format(noon(key));

/** "Fri, Nov 6 – Sun, Nov 8", "Sat, Nov 7", or null for a plan without dates. */
export function datesLabel(p: Pick<Plan, 'starts_on' | 'ends_on'>) {
  if (!p.starts_on) return null;
  const a = shortFmt.format(noon(p.starts_on));
  return !p.ends_on || p.ends_on === p.starts_on ? a : `${a} – ${shortFmt.format(noon(p.ends_on))}`;
}

export type DatePreset = { id: string; label: string; starts_on: string | null; ends_on: string | null };

/** Quick date choices for a new plan: no dates, today, this weekend, next weekend, the next 7 days. */
export function datePresets(now = new Date()): DatePreset[] {
  const today = todayKey(now);
  const d = weekday(today);
  // This weekend is Fri–Sun; from Saturday or Sunday it's what's left of it.
  const fri = d === 0 ? addDays(today, -2) : addDays(today, (5 - d + 7) % 7);
  const thisStart = d === 6 || d === 0 ? today : fri;
  const sun = addDays(fri, 2);
  return [
    { id: 'none', label: 'No dates', starts_on: null, ends_on: null },
    { id: 'today', label: 'Today', starts_on: today, ends_on: today },
    { id: 'weekend', label: 'This weekend', starts_on: thisStart, ends_on: sun },
    { id: 'next_weekend', label: 'Next weekend', starts_on: addDays(fri, 7), ends_on: addDays(sun, 7) },
    { id: 'week', label: 'Next 7 days', starts_on: today, ends_on: addDays(today, 6) },
  ];
}

const minutesOf = (t: string | null | undefined) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** The Wichita day and minute an item happens, so plans read in order. Null day = "Anytime". */
export function scheduleOf(item: PlanItem, plan: Pick<PlanDetail, 'starts_on' | 'ends_on'>, now = new Date()) {
  const r = item.ref;
  if ((item.kind === 'event' || item.kind === 'meetup') && r?.starts_at) {
    const untimed = r.all_day || r.time_tbd;
    return { day: dayKey(r.starts_at), minutes: untimed ? null : wichitaNow(new Date(r.starts_at)).minutes };
  }
  if (item.on_date) return { day: item.on_date, minutes: minutesOf(item.at_time) ?? minutesOf(r?.starts) };
  if (item.kind === 'special' && r?.days?.length) {
    // The next night it happens, from the plan's first day (or today) through its last day.
    const today = todayKey(now);
    const from = plan.starts_on && plan.starts_on > today ? plan.starts_on : today;
    for (let i = 0; i < 7; i++) {
      const key = addDays(from, i);
      if (plan.ends_on && key > plan.ends_on) break;
      if (r.days.includes(weekday(key))) return { day: key, minutes: minutesOf(r.starts) };
    }
  }
  return { day: null, minutes: minutesOf(item.at_time) };
}

/** Items grouped by day in order, with untimed and undated ones last. */
export function itinerary(plan: PlanDetail, now = new Date()) {
  const rows = plan.items.map((item) => ({ item, ...scheduleOf(item, plan, now) }));
  const days = [...new Set(rows.map((r) => r.day))].sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)));
  return days.map((day) => ({
    day,
    title: day ? dayTitle(day) : 'Anytime',
    rows: rows
      .filter((r) => r.day === day)
      .sort((a, b) => (a.minutes ?? 24 * 60) - (b.minutes ?? 24 * 60)),
  }));
}

/** The days a note or place can go on: the plan's days, or the next week when it has none. */
export function planDays(plan: Pick<PlanDetail, 'starts_on' | 'ends_on'>, now = new Date()) {
  const start = plan.starts_on ?? todayKey(now);
  const end = plan.ends_on ?? (plan.starts_on ? plan.starts_on : addDays(start, 6));
  const out: string[] = [];
  for (let k = start; k <= end && out.length < 14; k = addDays(k, 1)) out.push(k);
  return out;
}

export const shortDayName = (key: string) => DAY_LONG[weekday(key)].slice(0, 3);

// --- Data ---------------------------------------------------------------------------------

export async function getMyPlans(): Promise<Plan[]> {
  const { data, error } = await db()
    .from('plans')
    .select('id, title, starts_on, ends_on, share_code, updated_at, plan_items(count)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(({ plan_items, ...p }) => ({
    ...p,
    items: (plan_items as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function createPlan(title: string, starts_on: string | null, ends_on: string | null): Promise<string> {
  const { data, error } = await db()
    .from('plans')
    .insert({ title: title.trim(), starts_on, ends_on })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updatePlan(id: string, changes: Partial<Pick<Plan, 'title' | 'starts_on' | 'ends_on'>>) {
  const { error } = await db().from('plans').update(changes).eq('id', id);
  if (error) throw error;
}

export async function deletePlan(id: string) {
  const { error } = await db().from('plans').delete().eq('id', id);
  if (error) throw error;
}

export type NewItem = { kind: Exclude<PlanItemKind, 'note'>; ref_id: string } | { kind: 'note'; note: string; on_date: string | null };

export async function addToPlan(planId: string, item: NewItem) {
  const row: { plan_id: string; kind: PlanItemKind; ref_id?: string; note?: string; on_date?: string | null } =
    item.kind === 'note'
      ? { plan_id: planId, kind: 'note', note: item.note.trim(), on_date: item.on_date }
      : { plan_id: planId, kind: item.kind, ref_id: item.ref_id };
  const { error } = await db().from('plan_items').insert(row);
  if (error) throw error;
}

export async function setItemDay(itemId: string, on_date: string | null) {
  const { error } = await db().from('plan_items').update({ on_date }).eq('id', itemId);
  if (error) throw error;
}

export async function removeFromPlan(itemId: string) {
  const { error } = await db().from('plan_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function getPlan(id: string): Promise<PlanDetail | null> {
  const { data, error } = await db().rpc('get_plan', { plan: id });
  if (error) throw error;
  return data;
}

export async function getSharedPlan(code: string): Promise<PlanDetail | null> {
  const { data, error } = await db().rpc('get_plan', { code });
  if (error) throw error;
  return data;
}

/** Turns sharing on or off; returns the link code while shared. */
export async function setPlanSharing(id: string, shared: boolean): Promise<string | null> {
  const { data, error } = await db().rpc('set_plan_sharing', { plan: id, shared });
  if (error) throw error;
  return data;
}

export const planLink = (code: string) => `${WEB_URL}/p/${code}`;

export function sharePlan(plan: Pick<PlanDetail, 'title' | 'starts_on' | 'ends_on'>, code: string) {
  const when = datesLabel(plan);
  return shareLink(planLink(code), `My Wichita Life plan: ${plan.title}${when ? ` (${when})` : ''}`);
}
