/**
 * Local teams for Events > Sports. Games come from the Wichita Life calendar: an event is a team's
 * game when its title names the team and reads like a game ("vs.", "basketball", "exhibition"…).
 */
import { dayKey, startOfWichitaDay } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { EventItem, NewsItem } from '@/lib/types';

export type Team = { id: string; name: string; icon: string; plays: string; match: RegExp };

export const TEAMS: Team[] = [
  {
    id: 'shockers',
    name: 'Wichita State Shockers',
    icon: '🌾',
    plays: 'Basketball, volleyball, baseball, softball',
    match: /\b(wichita state|shockers?|wsu)\b/i,
  },
  { id: 'thunder', name: 'Wichita Thunder', icon: '🏒', plays: 'Hockey', match: /\bwichita thunder\b/i },
  { id: 'windsurge', name: 'Wichita Turbo Tubs', icon: '⚾', plays: 'Baseball', match: /wind surge|turbo tubs/i },
  { id: 'wings', name: 'Wichita Wings', icon: '⚽', plays: 'Indoor soccer', match: /wichita wings/i },
];

const GAME =
  /\b(vs\.?|versus|hockey|basketball|baseball|softball|volleyball|soccer|football|exhibition|tournament|match|game|doubleheader)\b/i;
const SPORT_WORDS = /\b(hockey|basketball|baseball|softball|volleyball|soccer|football|wrestling|rodeo)\b/i;

/** The local team playing in this event, if it's one of theirs. */
export function teamOf(e: EventItem): Team | undefined {
  if (!GAME.test(e.title)) return undefined;
  return TEAMS.find((t) => t.match.test(e.title));
}

/** Shockers sports, for the second row of chips. Women's basketball is told apart by "women". */
export const SHOCKER_SPORTS: { id: string; label: string; test: (title: string) => boolean }[] = [
  { id: 'mbb', label: 'Men’s basketball', test: (t) => /basketball/i.test(t) && !/women/i.test(t) },
  { id: 'wbb', label: 'Women’s basketball', test: (t) => /basketball/i.test(t) && /women/i.test(t) },
  { id: 'vb', label: 'Volleyball', test: (t) => /volleyball/i.test(t) },
  { id: 'bsb', label: 'Baseball', test: (t) => /baseball/i.test(t) },
  { id: 'sb', label: 'Softball', test: (t) => /softball/i.test(t) },
];

/** Team games plus other sporting events on the calendar (tournaments, races, college games). */
export const isSportsEvent = (e: EventItem) =>
  !!teamOf(e) ||
  SPORT_WORDS.test(e.title) ||
  ['Sport', 'Sports', 'Watching Sports'].some((t) => e.calendar_tags?.includes(t)) ||
  e.tags.includes('sports');

/** Whole days between today and the game, in Wichita time. */
export function daysUntil(iso: string, now = new Date()) {
  const a = Date.parse(dayKey(now.toISOString()));
  const b = Date.parse(dayKey(iso));
  return Math.round((b - a) / 86_400_000);
}

/** "Today", "Tomorrow" or "Next game in 6 days". */
export function nextGameLabel(iso: string, now = new Date()) {
  const n = daysUntil(iso, now);
  if (n <= 0) return 'Game today';
  if (n === 1) return 'Next game tomorrow';
  return `Next game in ${n} days`;
}

/** Upcoming sporting events, soonest first. Fetched separately so far-off seasons (April baseball) aren't cut off. */
export async function getSportsEvents(): Promise<EventItem[]> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const startOfToday = startOfWichitaDay();
  const words = ['wichita state', 'shocker', 'wsu', 'thunder', 'wind surge', 'turbo tubs', 'wichita wings', 'hockey', 'basketball', 'baseball', 'softball', 'volleyball', 'soccer', 'football'];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('hidden', false)
    .gte('starts_at', startOfToday.toISOString())
    .or([...words.map((w) => `title.ilike.*${w}*`), 'calendar_tags.ov.{Sport,Sports,"Watching Sports"}'].join(','))
    .order('starts_at')
    .limit(600);
  if (error) throw error;
  return (data as EventItem[]).filter(isSportsEvent);
}

const SPORTS_NEWS =
  /\b(shockers?|wichita state|thunder|wind surge|turbo tubs|wings|k-state|wildcats|jayhawks|chiefs|royals|football|basketball|baseball|softball|volleyball|hockey|soccer|playoffs?|scores?|quarterback|coach)\b/i;

/** Sports stories from the news feed. */
export const isSportsNews = (n: NewsItem) => SPORTS_NEWS.test(n.title);
