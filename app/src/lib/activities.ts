/**
 * Things to do for Explore's "What should we do?" picker. A short hand-picked list; add a spot here
 * and it's in the shuffle. Addresses checked Oct 2026.
 */
export type Activity = {
  id: string;
  name: string;
  kinds: ActivityKind[];
  blurb: string;
  address: string;
  website?: string;
};

export type ActivityKind = 'golf' | 'bowling' | 'arcade' | 'minigolf' | 'karts' | 'pickleball' | 'animals';

export const ACTIVITY_KINDS: { id: ActivityKind; label: string }[] = [
  { id: 'golf', label: '⛳ Golf' },
  { id: 'pickleball', label: '🏓 Pickleball' },
  { id: 'animals', label: '🦒 Animals' },
  { id: 'minigolf', label: '🏌️ Mini golf' },
  { id: 'bowling', label: '🎳 Bowling' },
  { id: 'arcade', label: '🕹️ Arcades' },
  { id: 'karts', label: '🏎️ Go-karts' },
];

export const ACTIVITIES: Activity[] = [
  {
    id: 'topgolf',
    name: 'Topgolf',
    kinds: ['golf', 'minigolf'],
    blurb: 'Hitting bays, food and drinks, plus a 9-hole mini course.',
    address: '2976 N Greenwich Rd, Wichita, KS 67226',
    website: 'https://topgolf.com/us/wichita/',
  },
  {
    id: 'shotsuite',
    name: 'ShotSuite',
    kinds: ['golf'],
    blurb: 'Private simulator suites for golf, baseball, soccer and zombie dodgeball, with a full bar and kitchen.',
    address: '4854 E 35th St N, Wichita, KS',
  },
  {
    id: 'chickennpickle',
    name: 'Chicken N Pickle',
    kinds: ['pickleball'],
    blurb: 'Pickleball courts, yard games and a big patio, plus rotisserie chicken.',
    address: '1240 N Greenwich Rd, Wichita, KS 67206',
    website: 'https://chickennpickle.com',
  },
  {
    id: 'tapnpaddles',
    name: 'TapNPaddles',
    kinds: ['pickleball'],
    blurb: '12 indoor pickleball courts with food and drinks. Reserve a court; non-members welcome.',
    address: '4956 E 35th St N, Wichita, KS',
  },
  {
    id: 'zoo',
    name: 'Sedgwick County Zoo',
    kinds: ['animals'],
    blurb: 'Elephants, Amur tigers, a boat ride and the Downing Gorilla Forest.',
    address: '5555 W Zoo Blvd, Wichita, KS 67212',
    website: 'https://scz.org',
  },
  {
    id: 'tanganyika',
    name: 'Tanganyika Wildlife Park',
    kinds: ['animals'],
    blurb: 'Hands-on animal encounters: feed giraffes, pet kangaroos. Open spring to mid-November; reserve ahead.',
    address: '1000 S Hawkins Ln, Goddard, KS 67052',
    website: 'https://twpark.com',
  },
  {
    id: 'mammoth',
    name: 'Mammoth Clubhouse',
    kinds: ['golf', 'minigolf'],
    blurb: '36 driving-range bays, three putting courses and a self-serve beer wall.',
    address: 'N Webb Rd just north of Central, Wichita, KS',
  },
  {
    id: 'megapines',
    name: 'Mega Pines Mini Golf',
    kinds: ['minigolf'],
    blurb: 'National-park-themed 18 holes, Gellyball and giant lawn games.',
    address: '1802 US-54, Andover, KS 67002',
  },
  {
    id: 'allstar',
    name: 'All Star Sports West',
    kinds: ['minigolf', 'karts'],
    blurb: 'Two 18-hole mini golf courses, go-karts, laser tag, bumper boats and batting cages.',
    address: '8333 W 21st St N, Wichita, KS 67205',
  },
  {
    id: 'glowgolf',
    name: 'Glowgolf',
    kinds: ['minigolf'],
    blurb: 'Indoor glow-in-the-dark mini golf with a laser maze.',
    address: '3035 N Rock Rd, Suite 200, Wichita, KS 67226',
  },
  {
    id: 'ojwatson',
    name: 'OJ Watson Park mini golf',
    kinds: ['minigolf'],
    blurb: 'Renovated 18 holes with local murals, lit for evening play.',
    address: 'OJ Watson Park, Wichita, KS',
  },
  {
    id: 'northrock',
    name: 'Bowlero Northrock',
    kinds: ['bowling', 'arcade'],
    blurb: 'The biggest bowling alley in Kansas: 48 lanes, an arcade and a sports bar.',
    address: '3232 N Rock Rd, Wichita, KS 67226',
  },
  {
    id: 'northridge',
    name: 'Bowlero Northridge',
    kinds: ['bowling', 'arcade'],
    blurb: '36 lanes on the west side (the old West Acres).',
    address: '749 N Ridge Rd, Wichita, KS 67212',
  },
  {
    id: 'thearcade',
    name: 'The Arcade',
    kinds: ['arcade'],
    blurb: 'Downtown barcade: 20+ pinball machines, retro games and skee-ball. 21+ late on weekends.',
    address: '906 E 3rd St N, Wichita, KS 67214',
  },
  {
    id: 'headshots',
    name: 'Headshots Arcade Bar & Grill',
    kinds: ['arcade'],
    blurb: '1,000+ video games, pinball and board games, with a $5 all-day pass.',
    address: '2120 N Woodlawn Blvd, Wichita, KS 67208',
  },
  {
    id: 'highvoltage',
    name: 'High Voltage Garage',
    kinds: ['arcade'],
    blurb: 'Pinball spot on East Central.',
    address: '1199 E Central Ave, Wichita, KS 67214',
    website: 'https://hvgarage316.com',
  },
];

/** A random activity of this kind (any kind when null), skipping the ones already shown. */
export function randomActivity(kind: ActivityKind | null, skip: string[] = []) {
  const pool = ACTIVITIES.filter((a) => (!kind || a.kinds.includes(kind)) && !skip.includes(a.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
