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

/**
 * Wichita's big annual races, for Events > Sports > Races. `when` is the usual date, so a race shows
 * all year; when it's on the calendar, the list shows its next date instead. `match` finds it there.
 */
export type Race = {
  id: string;
  name: string;
  when: string;
  month: number;
  distances: string;
  start: string;
  url: string;
  match: RegExp;
};

export const RACES: Race[] = [
  {
    id: 'st-patricks',
    name: 'St. Patrick’s Day 5K Run/Walk',
    when: 'A Sunday in mid-March',
    month: 3,
    distances: '5K, kids’ fun run',
    start: 'Old Cowtown Museum',
    url: 'https://runsignup.com/Race/KS/Wichita/WichitaStPatricks5KRunWalk',
    match: /st\.? patrick.*\b5k\b/i,
  },
  {
    id: 'prairie-fire-spring',
    name: 'Prairie Fire Spring Half Marathon & 5K',
    when: 'First Sunday in May',
    month: 5,
    distances: 'Half marathon, 5K',
    start: 'Century II, downtown',
    url: 'https://runsignup.com/Race/KS/Wichita/SpringPrairieFireHalfMarathon',
    match: /prairie fire.*(spring|half)/i,
  },
  {
    id: 'river-run',
    name: 'Riverfest River Run',
    when: 'Saturday of Riverfest’s opening weekend (late May or early June)',
    month: 6,
    distances: '10K, 5K, family fun run, Tot Trot',
    start: 'Douglas Ave. by Century II',
    url: 'https://wichitariverfest.com/river-run/',
    match: /river run/i,
  },
  {
    id: 'derby-firecracker',
    name: 'Derby Firecracker',
    when: 'July 4 every year',
    month: 7,
    distances: '4 miles, 1 mile',
    start: 'High Park, Derby',
    url: 'https://runsignup.com/Race/KS/Derby/DerbyFirecracker',
    match: /derby firecracker/i,
  },
  {
    id: 'road-home',
    name: 'Road Home Race',
    when: 'A Saturday in mid-September',
    month: 9,
    distances: '10K, 5K, 1-mile fun run',
    start: 'Sedgwick County Park',
    url: 'https://runsignup.com/Race/KS/Wichita/RoadHomeRace',
    match: /road home race/i,
  },
  {
    id: 'prairie-fire',
    name: 'Prairie Fire Marathon',
    when: 'Second Sunday in October',
    month: 10,
    distances: 'Marathon, half marathon, 5K, kids’ races',
    start: 'Riverfront Stadium',
    url: 'https://wichitasports.com/prairie-fire-marathon',
    match: /prairie fire marathon/i,
  },
  {
    id: 'pumpkin-run',
    name: 'WSU Pumpkin Run 5K',
    when: 'A Saturday in mid-October',
    month: 10,
    distances: '5K, Little Pumpkin 1K',
    start: 'Wichita State campus',
    url: 'https://www.wichita.edu/student_life/campus_recreation/events/pumpkinrun/pumpkinrun_index.php',
    match: /pumpkin run/i,
  },
  {
    id: 'turkey-trot',
    name: 'Wichita Turkey Trot',
    when: 'The Saturday before Thanksgiving',
    month: 11,
    distances: '10 miles, 2 miles, Tiny Turkey Trot',
    start: 'Century II, downtown',
    url: 'https://wichitasports.com/events/turkey-trot/',
    match: /wichita turkey trot/i,
  },
  {
    id: 'turkey-trails',
    name: 'Turkey Trails',
    when: 'A Sunday around Thanksgiving',
    month: 11,
    distances: 'Half marathon, 10K, 5K, 1 mile',
    start: 'Botanica',
    url: 'https://runsignup.com/Race/KS/Wichita/TurkeyTrailsWichita',
    match: /turkey trails/i,
  },
  {
    id: 'say-grace',
    name: 'Say Grace Thanksgiving Day 5K',
    when: 'Thanksgiving morning',
    month: 11,
    distances: '5K run/walk',
    start: 'GraceMed clinic, 1122 N. Topeka',
    url: 'https://www.gracemed.org/say-grace-race',
    match: /say grace/i,
  },
  {
    id: 'jingle-bell-run',
    name: 'Jingle Bell Run',
    when: 'Second Saturday in December',
    month: 12,
    distances: '5K, kids’ run',
    start: 'Botanica',
    url: 'https://runsignup.com/Race/KS/Wichita/JingleBellRunWichitaKS',
    match: /jingle bell run/i,
  },
];

const RACE_WORDS =
  /\b((5|8|10|15|25|50)\s?k|half marathon|marathon|trot|fun run|run\s?(\/|&|and)\s?walk|walk\s?(\/|&|and)\s?run|triathlon|duathlon|color run|glow run|river run|turkey trails|firecracker 4)\b/i;

/** A running race (5K, marathon, trot…) on the calendar. */
export const isRace = (e: Pick<EventItem, 'title'>) =>
  RACE_WORDS.test(e.title) || RACES.some((r) => r.match.test(e.title));

/** The big annual races, starting with the ones coming up soonest this year. */
export function racesByMonth(now = new Date()) {
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(now));
  return [...RACES].sort((a, b) => ((a.month - month + 12) % 12) - ((b.month - month + 12) % 12));
}

/** Team games plus other sporting events on the calendar (tournaments, races, college games). */
export const isSportsEvent = (e: EventItem) =>
  !!teamOf(e) ||
  isRace(e) ||
  SPORT_WORDS.test(e.title) ||
  ['Sport', 'Sports', 'Watching Sports'].some((t) => e.calendar_tags?.includes(t)) ||
  e.tags.includes('sports');

/** Whole days between today and the game, in Wichita time. */
export function daysUntil(iso: string, now = new Date()) {
  const a = Date.parse(dayKey(now.toISOString()));
  const b = Date.parse(dayKey(iso));
  return Math.round((b - a) / 86_400_000);
}

/** "Game today", "Next game tomorrow" or "Next game in 6 days" (or race). */
export function nextGameLabel(iso: string, now = new Date(), noun = 'game') {
  const n = daysUntil(iso, now);
  if (n <= 0) return `${noun[0].toUpperCase()}${noun.slice(1)} today`;
  if (n === 1) return `Next ${noun} tomorrow`;
  return `Next ${noun} in ${n} days`;
}

/** Upcoming sporting events, soonest first. Fetched separately so far-off seasons (April baseball) aren't cut off. */
export async function getSportsEvents(): Promise<EventItem[]> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const startOfToday = startOfWichitaDay();
  const words = ['wichita state', 'shocker', 'wsu', 'thunder', 'wind surge', 'turbo tubs', 'wichita wings', 'hockey', 'basketball', 'baseball', 'softball', 'volleyball', 'soccer', 'football'];
  // Races: "_" matches any one character in a title search, so "fun_run" finds "fun run" and "fun-run".
  const raceWords = ['5k', '10k', '15k', 'marathon', 'trot', 'fun_run', 'run_walk', 'walk_run', 'triathlon', 'river_run', 'turkey_trails', 'firecracker', 'pumpkin_run', 'say_grace', 'road_home'];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('hidden', false)
    .gte('starts_at', startOfToday.toISOString())
    .or([...words, ...raceWords].map((w) => `title.ilike.*${w}*`).concat('calendar_tags.ov.{Sport,Sports,"Watching Sports"}').join(','))
    .order('starts_at')
    .limit(600);
  if (error) throw error;
  return (data as EventItem[]).filter(isSportsEvent);
}

const SPORTS_NEWS =
  /\b(shockers?|wichita state|thunder|wind surge|turbo tubs|wings|k-state|wildcats|jayhawks|chiefs|royals|football|basketball|baseball|softball|volleyball|hockey|soccer|playoffs?|scores?|quarterback|coach)\b/i;

/** Sports stories from the news feed. */
export const isSportsNews = (n: NewsItem) => SPORTS_NEWS.test(n.title);
