/**
 * Weekly specials: happy hours, trivia, karaoke and other things that happen every week at the
 * same place. Staff keep the list (Staff tools > Weekly); days are 0 = Sunday ... 6 = Saturday,
 * times are Wichita local times like "16:00:00".
 */
import { supabase } from '@/lib/supabase';

export type WeeklyKind =
  | 'happy_hour'
  | 'trivia'
  | 'karaoke'
  | 'open_mic'
  | 'live_music'
  | 'game_night'
  | 'food_deal'
  | 'other';

export type WeeklySpecial = {
  id: string;
  kind: WeeklyKind;
  title: string;
  venue: string;
  address: string | null;
  days: number[];
  starts: string | null;
  ends: string | null;
  details: string | null;
  url: string | null;
  active: boolean;
  verified_on: string | null;
};

export const KINDS: { id: WeeklyKind; label: string; icon: string }[] = [
  { id: 'happy_hour', label: 'Happy hour', icon: '🍻' },
  { id: 'trivia', label: 'Trivia', icon: '🧠' },
  { id: 'karaoke', label: 'Karaoke', icon: '🎤' },
  { id: 'open_mic', label: 'Open mic', icon: '🎙️' },
  { id: 'live_music', label: 'Live music', icon: '🎸' },
  { id: 'game_night', label: 'Game night', icon: '🎲' },
  { id: 'food_deal', label: 'Food deal', icon: '🌮' },
  { id: 'other', label: 'Other', icon: '⭐' },
];
export const kindOf = (k: WeeklyKind) => KINDS.find((x) => x.id === k)!;

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getWeeklySpecials(): Promise<WeeklySpecial[]> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data, error } = await supabase
    .from('weekly_specials')
    .select('id, kind, title, venue, address, days, starts, ends, details, url, active, verified_on')
    .eq('active', true)
    .order('starts', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

const wichitaParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Day of the week (0 = Sunday) and minutes past midnight, in Wichita. */
export function wichitaNow(now = new Date()) {
  const p = Object.fromEntries(wichitaParts.formatToParts(now).map((x) => [x.type, x.value]));
  return { day: DAY_SHORT.indexOf(p.weekday), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** "4pm", "6:30pm". */
export function clock(t: string) {
  const [h, m] = t.split(':').map(Number);
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** "4–6pm", "From 7pm", "All day". */
export function hoursLabel(s: WeeklySpecial) {
  if (!s.starts) return 'All day';
  if (!s.ends) return `From ${clock(s.starts)}`;
  const a = clock(s.starts);
  const b = clock(s.ends);
  // Drop the first am/pm when both match: "4–6pm" rather than "4pm–6pm".
  const same = a.slice(-2) === b.slice(-2);
  return `${same ? a.slice(0, -2) : a}–${b}`;
}

/** "Mon–Fri", "Tue", "Thu & Sat", "Every day". */
export function daysLabel(days: number[]) {
  const d = [...days].sort();
  if (d.length === 7) return 'Every day';
  const run = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  if (run && d.length >= 3) return `${DAY_SHORT[d[0]]}–${DAY_SHORT[d[d.length - 1]]}`;
  if (d.length === 2) return `${DAY_SHORT[d[0]]} & ${DAY_SHORT[d[1]]}`;
  return d.map((x) => DAY_SHORT[x]).join(', ');
}

/** Going on right now, in Wichita. Ends past midnight (e.g. 9pm–1am) count into the next day. */
export function isHappeningNow(s: WeeklySpecial, now = wichitaNow()) {
  if (!s.starts || !s.ends) return false;
  const start = toMinutes(s.starts);
  let end = toMinutes(s.ends);
  if (end <= start) end += 24 * 60;
  const today = s.days.includes(now.day) && now.minutes >= start && now.minutes < end;
  const fromYesterday = s.days.includes((now.day + 6) % 7) && now.minutes + 24 * 60 < end;
  return today || fromYesterday;
}

/** Still to come (or going on) today. */
export function isLaterToday(s: WeeklySpecial, now = wichitaNow()) {
  if (!s.days.includes(now.day)) return false;
  if (!s.starts) return true;
  if (isHappeningNow(s, now)) return true;
  return toMinutes(s.starts) > now.minutes;
}

const COUNT_WORDS: Record<WeeklyKind, [one: string, many: string]> = {
  happy_hour: ['happy hour', 'happy hours'],
  trivia: ['trivia night', 'trivia nights'],
  karaoke: ['karaoke night', 'karaoke nights'],
  open_mic: ['open mic', 'open mics'],
  live_music: ['live music spot', 'live music spots'],
  game_night: ['game night', 'game nights'],
  food_deal: ['food deal', 'food deals'],
  other: ['special', 'specials'],
};

/** "1 trivia night", "3 happy hours". */
export const countLabel = (kind: WeeklyKind, n: number) => `${n} ${COUNT_WORDS[kind][n === 1 ? 0 : 1]}`;
