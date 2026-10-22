// Places to eat from OpenStreetMap (via the Overpass API), for "Where should I eat?".

export type PlaceRow = {
  osm_id: string;
  name: string;
  kind: 'restaurant' | 'fast_food' | 'cafe' | 'dessert' | 'pub';
  cuisine: string[];
  categories: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  /** Has an OpenStreetMap brand, i.e. a chain. Only used for new places; staff can change it. */
  branded: boolean;
};

/**
 * Everything to eat in the Wichita area (a box from Maize/Goddard to Andover, Park City to Derby's
 * north edge). Bars are left out; pubs, which serve food, stay.
 */
export const OVERPASS_QUERY = `[out:json][timeout:90][bbox:37.56,-97.52,37.81,-97.16];
nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|pub)$"]["name"];
out center tags;`;

export const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const KIND: Record<string, PlaceRow['kind']> = {
  restaurant: 'restaurant',
  fast_food: 'fast_food',
  cafe: 'cafe',
  ice_cream: 'dessert',
  pub: 'pub',
};

/** The app's cuisine groups (the chips on Explore) and the OpenStreetMap cuisine values in each. */
export const CATEGORIES: Record<string, string[]> = {
  mexican: ['mexican', 'tex-mex', 'tacos', 'taco', 'latin_american', 'salvadoran', 'burrito', 'peruvian', 'cuban'],
  bbq: ['barbecue', 'bbq', 'smokehouse'],
  pizza: ['pizza'],
  burgers: ['burger', 'burgers', 'hamburger'],
  asian: ['chinese', 'japanese', 'sushi', 'thai', 'vietnamese', 'korean', 'asian', 'pho', 'ramen', 'filipino', 'noodle', 'dim_sum', 'hawaiian', 'poke', 'laotian', 'cambodian'],
  indian: ['indian', 'pakistani', 'nepalese'],
  mediterranean: ['mediterranean', 'greek', 'lebanese', 'middle_eastern', 'turkish', 'kebab', 'falafel', 'persian', 'arab'],
  italian: ['italian', 'pasta'],
  breakfast: ['breakfast', 'brunch', 'pancake', 'waffle', 'bagel', 'donut', 'crepe'],
  sandwiches: ['sandwich', 'deli', 'sub', 'subs', 'bagel', 'hot_dog'],
  chicken: ['chicken', 'wings', 'fried_chicken'],
  steak_seafood: ['steak_house', 'steak', 'seafood', 'fish', 'cajun', 'fish_and_chips', 'crab'],
  coffee: ['coffee_shop', 'coffee', 'tea', 'bubble_tea'],
  dessert: ['ice_cream', 'dessert', 'frozen_yogurt', 'donut', 'cupcake', 'cake', 'pie', 'custard', 'bakery'],
  american: ['american', 'regional', 'southern', 'soul_food', 'diner', 'comfort_food'],
};

export function categoriesFor(kind: PlaceRow['kind'], cuisine: string[]) {
  const out = new Set<string>();
  for (const [cat, values] of Object.entries(CATEGORIES)) if (cuisine.some((c) => values.includes(c))) out.add(cat);
  if (kind === 'cafe') out.add('coffee');
  if (kind === 'dessert') out.add('dessert');
  return [...out];
}

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function parseOverpass(json: { elements?: OsmElement[] }): PlaceRow[] {
  const rows: PlaceRow[] = [];
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const kind = KIND[t.amenity ?? ''];
    const name = (t.name ?? '').trim();
    if (!kind || !name) continue;
    // Mappers mark some closed places this way instead of deleting them.
    if (/\b(closed|permanently closed)\b/i.test(name) || t.opening_hours === 'closed' || t['disused:amenity']) continue;
    const cuisine = (t.cuisine ?? '')
      .split(';')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    const city = t['addr:city'] && !/^wichita$/i.test(t['addr:city']) ? t['addr:city'] : '';
    const point = el.center ?? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : null);
    const website = t.website ?? t['contact:website'] ?? null;
    rows.push({
      osm_id: `${el.type}/${el.id}`,
      name,
      kind,
      cuisine,
      categories: categoriesFor(kind, cuisine),
      address: [street, city].filter(Boolean).join(', ') || null,
      lat: point?.lat ?? null,
      lng: point?.lon ?? null,
      website: website && /^https?:\/\//.test(website) ? website : null,
      phone: t.phone ?? t['contact:phone'] ?? null,
      opening_hours: t.opening_hours ?? null,
      branded: Boolean(t.brand || t['brand:wikidata']),
    });
  }
  return rows;
}

/**
 * New places count as chains when OpenStreetMap gives them a brand, or when the same name shows up
 * three or more times in town (local chains too). Staff can flip it, e.g. for Wichita-born chains.
 */
export function chainNames(rows: PlaceRow[]) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.name.toLowerCase(), (counts.get(r.name.toLowerCase()) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n >= 3).map(([name]) => name));
}
