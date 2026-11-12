// Today's Wichita weather for the greeting on the Today tab, from the National Weather Service:
// the latest reading at the Wichita airport (KICT) plus today's high and tonight's low from the
// forecast. Runs every 20 minutes and keeps one row in public.weather.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';

const NWS = 'https://api.weather.gov';
const WICHITA = '37.6872,-97.3301';
const STATION = 'KICT';
// The weather service asks every app to identify itself.
const HEADERS = { 'User-Agent': '(Wichita Life app, app.wichitalifeict.com)', Accept: 'application/geo+json' };

type Period = { startTime: string; isDaytime: boolean; temperature: number; shortForecast: string; icon: string };

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Weather service ${new URL(url).pathname}: HTTP ${res.status}`);
  return res.json();
}

const chicagoDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

/** An emoji for the conditions ("Partly Cloudy", "Light Rain and Fog"…), with a moon at night. */
export function weatherEmoji(text: string, night: boolean) {
  const t = text.toLowerCase();
  if (/thunder|t-storm/.test(t)) return '⛈️';
  if (/snow|flurr|blizzard/.test(t)) return '❄️';
  if (/sleet|freezing|ice pellets|wintry/.test(t)) return '🌨️';
  if (/rain|shower|drizzle/.test(t)) return '🌧️';
  if (/fog|haze|mist|smoke|dust/.test(t)) return '🌫️';
  if (/overcast|mostly cloudy|^cloudy/.test(t)) return '☁️';
  if (/partly|few clouds|scattered|mostly sunny|mostly clear/.test(t)) return night ? '☁️' : '⛅';
  if (/clear|sunny|fair/.test(t)) return night ? '🌙' : '☀️';
  if (/wind|breez/.test(t)) return '💨';
  return night ? '🌙' : '⛅';
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);
  const db = adminClient();
  const now = new Date();
  const today = chicagoDay(now);

  try {
    const point = await get<{ properties: { forecast: string; forecastHourly: string } }>(`${NWS}/points/${WICHITA}`);
    const [obs, forecast] = await Promise.all([
      get<{
        properties: { timestamp: string; textDescription: string; icon: string | null; temperature: { value: number | null } };
      }>(`${NWS}/stations/${STATION}/observations/latest`).catch(() => null),
      get<{ properties: { periods: Period[] } }>(point.properties.forecast),
    ]);

    // The airport reading, unless it's missing or more than 2 hours old; then the hourly forecast.
    const o = obs?.properties;
    const fresh = o && o.temperature.value !== null && now.getTime() - Date.parse(o.timestamp) < 2 * 3_600_000;
    let temp: number;
    let conditions: string;
    let night: boolean;
    let observedAt: string;
    if (fresh) {
      temp = Math.round((o.temperature.value! * 9) / 5 + 32);
      conditions = o.textDescription || '';
      night = /\/night\//.test(o.icon ?? '');
      observedAt = o.timestamp;
    } else {
      const hourly = await get<{ properties: { periods: Period[] } }>(point.properties.forecastHourly);
      const h = hourly.properties.periods[0];
      if (!h) throw new Error('Weather service: empty hourly forecast');
      temp = h.temperature;
      conditions = h.shortForecast;
      night = !h.isDaytime;
      observedAt = h.startTime;
    }

    // Today's high is the daytime period that starts today; tonight's low the night one. After
    // dark the forecast starts at "Tonight", so keep the high saved earlier today.
    const periods = forecast.properties.periods;
    const startsToday = (p: Period) => chicagoDay(new Date(p.startTime)) === today;
    let high = periods.find((p) => p.isDaytime && startsToday(p))?.temperature ?? null;
    const low = periods.find((p) => !p.isDaytime && startsToday(p))?.temperature ?? null;
    if (high === null) {
      const { data: saved } = await db.from('weather').select('high_f, forecast_day').eq('id', 1).maybeSingle();
      if (saved?.forecast_day === today) high = saved.high_f;
    }

    const row = {
      id: 1,
      temp_f: temp,
      conditions: conditions.slice(0, 80) || null,
      icon: weatherEmoji(conditions, night),
      high_f: high,
      low_f: low,
      forecast_day: today,
      observed_at: observedAt,
      synced_at: now.toISOString(),
    };
    const { error } = await db.from('weather').upsert(row);
    if (error) return json({ error: error.message }, 500);
    return json(row);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
