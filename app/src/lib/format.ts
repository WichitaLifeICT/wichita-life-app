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
