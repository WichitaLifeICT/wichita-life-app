/** Dates are always shown in Wichita time, wherever the phone is. */
const TZ = 'America/Chicago';

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayHeadingFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
const shortDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short' });
const dateNumFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });

export const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
export const dayHeading = (iso: string) => dayHeadingFmt.format(new Date(iso));
export const shortDay = (iso: string) => shortDayFmt.format(new Date(iso));
export const monthShort = (iso: string) => monthFmt.format(new Date(iso));
export const dateNum = (iso: string) => dateNumFmt.format(new Date(iso));

export function timeLabel(iso: string, allDay = false) {
  if (allDay) return 'All day';
  return timeFmt.format(new Date(iso)).replace(':00', '').replace(' ', '').toLowerCase();
}

/** True on Fridays in Wichita time (new Crossroads crossword day). */
export const isFridayInWichita = (now = new Date()) => weekdayFmt.format(now) === 'Fri';

/** "7:30" and "PM", for big time labels. */
export function timeParts(iso: string) {
  const [time, ampm] = timeFmt.format(new Date(iso)).split(/\s+/);
  return { time, ampm: (ampm ?? '').toUpperCase() };
}

/** Friday through Sunday of the current week, in Wichita time. */
export function isThisWeekend(iso: string, now = new Date()) {
  const d = new Date(iso);
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  const wd = weekdayFmt.format(d);
  return days > -1 && days < 7 && ['Fri', 'Sat', 'Sun'].includes(wd);
}

export function relativeTime(iso: string, now = new Date()) {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const todayHeading = (now = new Date()) => dayHeadingFmt.format(now);

export function countdown(iso: string, now = new Date()) {
  const ms = Math.max(new Date(iso).getTime() - now.getTime(), 0);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}

// Staff type dates as "2026-10-25 18:00" in Wichita time.
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function wichitaParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

export function toWichitaInput(iso: string) {
  const p = wichitaParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

/** Parses "YYYY-MM-DD HH:MM" as Wichita time. Returns null if it isn't in that shape. */
export function fromWichitaInput(text: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = wichitaParts(new Date(guess));
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - guess;
  return new Date(guess - offset).toISOString();
}
