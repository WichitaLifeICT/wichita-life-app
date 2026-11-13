/**
 * Parts of town for the Events tab's "Where" picker. Most calendar addresses end in a ZIP code, so
 * the ZIP decides the area; an address in another town counts as Nearby towns. Events with no
 * usable address (just "Wichita, Kansas") have no area and only show under Anywhere.
 */

export const AREAS = [
  { id: 'downtown', label: 'Downtown & Old Town' },
  { id: 'delano', label: 'Delano & Riverside' },
  { id: 'collegehill', label: 'College Hill & East Douglas' },
  { id: 'east', label: 'East Wichita' },
  { id: 'west', label: 'West Wichita' },
  { id: 'north', label: 'North Wichita' },
  { id: 'south', label: 'South Wichita' },
  { id: 'nearby', label: 'Nearby towns' },
] as const;

export type AreaId = (typeof AREAS)[number]['id'];

const BY_ZIP: Record<string, AreaId> = {
  '67202': 'downtown',
  '67203': 'delano',
  '67213': 'delano',
  '67208': 'collegehill',
  '67214': 'collegehill',
  '67218': 'collegehill',
  '67260': 'collegehill',
  '67206': 'east',
  '67207': 'east',
  '67220': 'east',
  '67226': 'east',
  '67228': 'east',
  '67230': 'east',
  '67205': 'west',
  '67209': 'west',
  '67212': 'west',
  '67215': 'west',
  '67223': 'west',
  '67235': 'west',
  '67204': 'north',
  '67219': 'north',
  '67210': 'south',
  '67211': 'south',
  '67216': 'south',
  '67217': 'south',
  '67221': 'south',
};

// When there's no ZIP, a few names give it away.
const BY_NAME: [RegExp, AreaId][] = [
  [/old town|downtown/i, 'downtown'],
  [/delano/i, 'delano'],
  [/college hill|wichita state|\bWSU\b/i, 'collegehill'],
  [/west wichita/i, 'west'],
  [/east wichita/i, 'east'],
];

/** The part of town an event is in, or null when its address doesn't say. */
export function areaOf(e: { venue: string | null; address: string | null }): AreaId | null {
  const address = e.address ?? '';
  const zip = /\b(67\d{3})\b/.exec(address)?.[1];
  if (zip && BY_ZIP[zip]) return BY_ZIP[zip];
  // "…, Park City, KS 67147", "…, Andover, KS": a town that isn't Wichita.
  const town = /,\s*([A-Za-z .]+?),?\s*(?:KS|Kansas)\b/.exec(address)?.[1]?.trim();
  if (town && !/^wichita$/i.test(town)) return 'nearby';
  const text = `${e.venue ?? ''} ${address}`;
  return BY_NAME.find(([r]) => r.test(text))?.[1] ?? null;
}

export const areaLabel = (id: AreaId) => AREAS.find((a) => a.id === id)!.label;
