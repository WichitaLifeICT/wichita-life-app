/**
 * Events > Arts: theater, comedy, symphony, ballet and other stage shows. An event counts when the
 * calendar tags it Performing Arts or Comedy, it's at one of the stages below, or its title reads like a show.
 */
import { isLiveMusic } from '@/lib/events';
import { isThisWeekend, startOfWichitaDay } from '@/lib/format';
import { daysUntil, isSportsEvent } from '@/lib/sports';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';

export type Stage = { id: string; name: string; icon: string; blurb: string; test: (e: EventItem) => boolean };

const text = (e: EventItem) => `${e.venue ?? ''} ${e.title} ${e.description ?? ''}`;

export const STAGES: Stage[] = [
  { id: 'roxys', name: 'Roxy’s Downtown', icon: '🎭', blurb: 'Downtown cabaret theater', test: (e) => /roxy/i.test(`${e.venue} ${e.title}`) },
  {
    id: 'mosley',
    name: 'Mosley Street Melodrama',
    icon: '🎩',
    blurb: 'Dinner theater & improv',
    test: (e) => /mosley|melodrama/i.test(`${e.venue} ${e.title}`),
  },
  { id: 'broadway', name: 'Broadway Wichita', icon: '🎟️', blurb: 'Touring Broadway shows', test: (e) => /broadway wichita/i.test(text(e)) },
  {
    id: 'wct',
    name: 'Wichita Children’s Theatre',
    icon: '🧸',
    blurb: 'Shows for kids & families',
    test: (e) => /children[’']?s theat/i.test(text(e)),
  },
  {
    id: 'wctheatre',
    name: 'Wichita Community Theatre',
    icon: '🏠',
    blurb: 'Local plays in College Hill',
    test: (e) => /wichita community theat|258 n\.? fountain/i.test(`${text(e)} ${e.address ?? ''}`),
  },
  {
    id: 'forum',
    name: 'The Forum Theatre',
    icon: '🎬',
    blurb: 'Plays & musicals at The Forum on S Ellis',
    test: (e) => /forum theat|141 s\.? ellis/i.test(`${text(e)} ${e.address ?? ''}`),
  },
  {
    id: 'symphony',
    name: 'Wichita Symphony Orchestra',
    icon: '🎻',
    blurb: 'Classics, pops & holiday concerts',
    test: (e) => /wichita symphony/i.test(text(e)),
  },
  {
    id: 'ballet',
    name: 'Ballet Wichita',
    icon: '🩰',
    blurb: 'Ballet & contemporary dance',
    test: (e) => /ballet wichita/i.test(text(e)),
  },
  {
    id: 'opera',
    name: 'Wichita Grand Opera',
    icon: '🎶',
    blurb: 'Opera at Century II',
    // Its listings don't always name it; its season (Tosca, Cavalleria/Pagliacci) does show up.
    test: (e) => /wichita grand opera|\bopera\b|tosca|cavalleria|pagliacci/i.test(text(e)),
  },
  {
    id: 'century2',
    name: 'Century II',
    icon: '🏛️',
    blurb: 'Broadway, ballet, symphony & more',
    test: (e) => /century (ii|2)/i.test(e.venue ?? ''),
  },
];

const SHOW =
  /\b(theat(er|re)s?|musicals?|broadway|ballets?|nutcracker|operas?|symphon(y|ies)|orchestras?|choirs?|improv|melodrama|comedy|comedian|stand-?up|cabaret|drag (show|queen)s?|rocky horror|magician|circus|on ice)\b/i;
// Words in a description that mean it's a stage show rather than a concert.
const SHOW_TEXT = new RegExp(`${SHOW.source}|\\b(humou?r|dancers|choreograph\\w*|dance (performance|company|show)s?|stage adaptation|murder mystery)\\b`, 'i');
// Conventions, markets and races also happen at Century II.
const NOT_SHOW = /\b(fest|festival|con|expo|market|flea|mart|conference|trot|gun|knife|sale|slam)\b/i;
const tagged = (e: EventItem, ...t: string[]) => t.some((x) => e.calendar_tags?.includes(x));

export function isArtsEvent(e: EventItem) {
  if (isSportsEvent(e) || NOT_SHOW.test(e.title) || /exploration place/i.test(e.venue ?? '')) return false;
  if (SHOW.test(e.title) || e.tags.includes('arts') || /symphony|ballet|opera/i.test(e.venue ?? '')) return true;
  if (STAGES.some((s) => s.id !== 'century2' && s.test(e))) return true;
  if (!tagged(e, 'Performing Arts', 'Comedy')) return false;
  // The calendar tags plenty of concerts Performing Arts or Comedy; those count only if the description reads like a show.
  const about = e.description ?? '';
  if (SHOW_TEXT.test(about)) return true;
  return !isLiveMusic(e) && !/\bconcert\b/i.test(about);
}

/** Live music that isn't a stage show: what the Music view and "music tonight" list. */
export const isMusicShow = (e: EventItem) => isLiveMusic(e) && !isArtsEvent(e);

export const ARTS_FILTERS: { id: string; label: string; test: (e: EventItem) => boolean }[] = [
  { id: 'weekend', label: 'This weekend', test: (e) => isThisWeekend(e.starts_at) },
  {
    id: 'theater',
    label: 'Theater',
    test: (e) =>
      /\b(theat(er|re)|musical|broadway|play|melodrama|cabaret|murder mystery|rocky horror)\b/i.test(e.title) ||
      /\b(broadway musical|musical comedy|stage adaptation|live theat(er|re))\b/i.test(e.description ?? '') ||
      STAGES.some((s) => ['roxys', 'mosley', 'broadway', 'wct', 'wctheatre', 'forum'].includes(s.id) && s.test(e)),
  },
  {
    id: 'comedy',
    label: 'Comedy',
    test: (e) => tagged(e, 'Comedy') || /\b(comedy|comedian|improv|stand-?up)\b/i.test(e.title),
  },
  {
    id: 'music',
    label: 'Symphony, ballet & dance',
    test: (e) =>
      /\b(symphony|orchestra|ballet|nutcracker|opera|choir|dance|celtic)\b/i.test(`${e.venue} ${e.title}`),
  },
  { id: 'family', label: 'Family', test: (e) => tagged(e, 'Family Friendly') || e.tags.includes('family') },
];

/** "Show tonight", "Next show tomorrow" or "Next show in 6 days". */
export function nextShowLabel(iso: string, now = new Date()) {
  const n = daysUntil(iso, now);
  if (n <= 0) return 'Show today';
  if (n === 1) return 'Next show tomorrow';
  return `Next show in ${n} days`;
}

/** Upcoming stage shows, soonest first. Fetched separately so shows booked months out aren't cut off. */
export async function getArtsEvents(): Promise<EventItem[]> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const startOfToday = startOfWichitaDay();
  const words = ['theat', 'musical', 'broadway', 'ballet', 'nutcracker', 'opera', 'symphony', 'orchestra', 'choir', 'improv', 'melodrama', 'comedy', 'comedian', 'cabaret'];
  const venues = ['roxy', 'mosley', 'melodrama', 'children', 'century ii', 'community theat', 'forum', 'wilke', 'symphony', 'ballet', 'opera'];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('hidden', false)
    .gte('starts_at', startOfToday.toISOString())
    .or(
      [
        ...words.map((w) => `title.ilike.*${w}*`),
        ...venues.map((v) => `venue.ilike.*${v}*`),
        ...['ballet wichita', 'grand opera', 'wichita symphony', 'forum theat', 'community theat'].map((d) => `description.ilike.*${d}*`),
        'calendar_tags.ov.{"Performing Arts",Comedy}',
      ].join(','),
    )
    .order('starts_at')
    .limit(600);
  if (error) throw error;
  return (data as EventItem[]).filter(isArtsEvent);
}
