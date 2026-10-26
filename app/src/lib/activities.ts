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
  /** Months it's open (1 = January). Left out for year-round spots; seasonal ones only come up in season. */
  months?: number[];
};

export type ActivityKind =
  | 'golf'
  | 'bowling'
  | 'arcade'
  | 'minigolf'
  | 'karts'
  | 'pickleball'
  | 'animals'
  | 'museums'
  | 'creative'
  | 'active'
  | 'outdoors'
  | 'daytrip'
  | 'movies';

export const ACTIVITY_KINDS: { id: ActivityKind; label: string }[] = [
  { id: 'golf', label: '⛳ Golf' },
  { id: 'pickleball', label: '🏓 Pickleball' },
  { id: 'animals', label: '🦒 Animals' },
  { id: 'minigolf', label: '🏌️ Mini golf' },
  { id: 'bowling', label: '🎳 Bowling' },
  { id: 'arcade', label: '🕹️ Arcades' },
  { id: 'karts', label: '🏎️ Racing & go-karts' },
  { id: 'museums', label: '🏛️ Museums' },
  { id: 'creative', label: '🎨 Make something' },
  { id: 'active', label: '🤸 Jump & climb' },
  { id: 'outdoors', label: '🌳 Outdoors' },
  { id: 'movies', label: '🍿 Movies' },
  { id: 'daytrip', label: '🚗 Day trips' },
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
    blurb: 'Elephants, gorillas, a boat ride and hundreds of species. A Wichita classic.',
    address: '5555 W Zoo Blvd, Wichita, KS 67212',
    website: 'https://scz.org',
  },
  {
    id: 'tanganyika',
    name: 'Tanganyika Wildlife Park',
    kinds: ['animals'],
    blurb: 'Hands-on animal encounters: feed giraffes, pet kangaroos. Reserve ahead.',
    address: '1000 S Hawkins Ln, Goddard, KS 67052',
    website: 'https://twpark.com',
    months: [3, 4, 5, 6, 7, 8, 9, 10, 11],
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
    kinds: ['minigolf', 'karts'],
    blurb: 'National-park-themed 18 holes, go-karts, Gellyball and giant lawn games.',
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
    id: 'glashaus',
    name: 'Glas Haus Racing',
    kinds: ['karts'],
    blurb: 'Pro-level racing simulators: drive anything from karts to F1 cars on real-world tracks.',
    address: '7817 E 37th St N, Wichita, KS 67226',
    website: 'https://www.glashausracing.com',
  },
  {
    id: 'holidaybowl',
    name: 'The Holiday Bowl',
    kinds: ['bowling', 'daytrip'],
    blurb: 'Restored 1958 bowling alley in downtown Augusta with a bar, kitchen and live music.',
    address: '310 State St, Augusta, KS 67010',
    website: 'https://www.theholidaybowl.com',
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
  {
    id: 'luckystrike',
    name: 'Lucky Strike Wichita',
    kinds: ['bowling', 'karts', 'arcade'],
    blurb: 'Bowling, indoor go-karts and a big arcade under one roof (the old Alley).',
    address: '11413 E 13th St N, Wichita, KS 67206',
    website: 'https://www.luckystrikeent.com/location/lucky-strike-wichita',
  },
  {
    id: 'skyzone',
    name: 'Sky Zone',
    kinds: ['active'],
    blurb: 'Trampoline park with a ninja course and glow nights.',
    address: '3535 N Rock Rd, Wichita, KS 67226',
    website: 'https://www.skyzone.com/wichita-ks/',
  },
  {
    id: 'urbanair',
    name: 'Urban Air Wichita',
    kinds: ['active'],
    blurb: 'Trampolines, climbing walls and indoor obstacle courses.',
    address: 'Urban Air Trampoline Park, Wichita, KS',
    website: 'https://www.urbanair.com/kansas-wichita/',
  },
  {
    id: 'exploration',
    name: 'Exploration Place',
    kinds: ['museums'],
    blurb: 'Hands-on science center on the river, with a dome theater.',
    address: '300 N McLean Blvd, Wichita, KS 67203',
    website: 'https://exploration.org',
  },
  {
    id: 'wam',
    name: 'Wichita Art Museum',
    kinds: ['museums'],
    blurb: 'American art collection, an outdoor art garden and a café.',
    address: '1400 W Museum Blvd, Wichita, KS 67203',
    website: 'https://wam.org',
  },
  {
    id: 'worldtreasures',
    name: 'Museum of World Treasures',
    kinds: ['museums'],
    blurb: 'Three floors downtown: a T. rex, mummies and pieces of the Berlin Wall.',
    address: '835 E 1st St N, Wichita, KS 67202',
    website: 'https://worldtreasures.org',
  },
  {
    id: 'cowtown',
    name: 'Old Cowtown Museum',
    kinds: ['museums', 'outdoors'],
    blurb: 'Walk a re-created 1870s Wichita cattle town.',
    address: '1865 W Museum Blvd, Wichita, KS 67203',
    website: 'https://www.oldcowtown.org',
  },
  {
    id: 'aviation',
    name: 'Kansas Aviation Museum',
    kinds: ['museums'],
    blurb: 'Planes and Air Capital history in the old Wichita airport terminal.',
    address: '3350 S George Washington Blvd, Wichita, KS 67210',
    website: 'https://kansasaviationmuseum.org',
  },
  {
    id: 'history',
    name: 'Wichita-Sedgwick County Historical Museum',
    kinds: ['museums'],
    blurb: 'Local history in the 1892 city hall downtown.',
    address: '204 S Main St, Wichita, KS 67202',
    website: 'https://wichitahistory.org',
  },
  {
    id: 'indianmuseum',
    name: 'Mid-America All-Indian Museum',
    kinds: ['museums'],
    blurb: 'American Indian art and culture, next to the Keeper of the Plains.',
    address: '650 N Seneca St, Wichita, KS 67203',
    website: 'https://theindianmuseum.org',
  },
  {
    id: 'karg',
    name: 'Karg Art Glass',
    kinds: ['creative'],
    blurb: 'Blow your own glass ornament or paperweight. Call ahead to book.',
    address: '111 N Oliver Ave, Kechi, KS 67067',
    website: 'https://rollinkarg.com',
  },
  {
    id: 'painttowne',
    name: 'Paint the Towne',
    kinds: ['creative'],
    blurb: 'Paint pottery or a canvas, with BYOB adult classes.',
    address: '1625 S Rock Rd #135, Wichita, KS',
    website: 'https://www.paintthetowne.com',
  },
  {
    id: 'boardbrush',
    name: 'Board & Brush',
    kinds: ['creative'],
    blurb: 'BYOB workshop where you build and paint your own wood sign.',
    address: '1108 E Douglas Ave, Wichita, KS',
    website: 'https://boardandbrush.com/wichita/',
  },
  {
    id: 'markarts',
    name: 'Mark Arts',
    kinds: ['creative', 'museums'],
    blurb: 'Art center with ceramics, painting, jewelry and cooking classes, plus a gallery.',
    address: '1307 N Rock Rd, Wichita, KS 67206',
    website: 'https://www.markartsks.com',
  },
  {
    id: 'wichitapottery',
    name: 'Wichita Pottery',
    kinds: ['creative'],
    blurb: 'Wheel-throwing and hand-building classes.',
    address: '300 N Meridian, Wichita, KS 67203',
    website: 'https://wichitapottery.com',
  },
  {
    id: 'carousel',
    name: 'Carousel Skate Center',
    kinds: ['active'],
    blurb: 'Family-run roller rink with an arcade, a big indoor playground and Friday adult skate nights.',
    address: '312 N West St, Wichita, KS 67203',
  },
  {
    id: 'bliss',
    name: 'Bliss Climbing and Fitness',
    kinds: ['active'],
    blurb: 'Climbing gym with 40-foot rope walls and a bouldering area. Beginners welcome.',
    address: '11114 E 28th St N, Wichita, KS 67226',
    website: 'https://climbbliss.com',
  },
  {
    id: 'lapo',
    name: 'Lake Afton Public Observatory',
    kinds: ['outdoors', 'museums'],
    blurb: 'Look through big telescopes on Friday and Saturday nights, 7:30 to 9:30.',
    address: '25000 W 39th St S, Goddard, KS 67052',
    website: 'https://www.lakeafton.com',
  },
  {
    id: 'walters',
    name: 'Walter’s Pumpkin Patch',
    kinds: ['outdoors', 'daytrip'],
    blurb: 'Big fall farm with pumpkins, a corn maze and a pile of activities. Wed–Sun through Nov 1.',
    address: '10001 NW US Highway 77, Burns, KS 66840',
    website: 'https://www.walterspumpkinpatch.com',
    months: [9, 10],
  },
  {
    id: 'prairiepines',
    name: 'Christmas at Prairie Pines',
    kinds: ['outdoors'],
    blurb: 'Cut your own Christmas tree, with hayrack rides and Santa.',
    address: '4055 N Tyler Rd, Maize, KS 67101',
    website: 'https://www.prairiepines.com',
    months: [11, 12],
  },
  {
    id: 'botanica',
    name: 'Botanica',
    kinds: ['outdoors'],
    blurb: 'Gardens by the river, including a big children’s garden.',
    address: '701 N Amidon St, Wichita, KS',
    website: 'https://botanica.org',
  },
  {
    id: 'gpnc',
    name: 'Great Plains Nature Center',
    kinds: ['outdoors', 'animals'],
    blurb: 'Free nature center with trails, ponds and wildlife exhibits.',
    address: '6232 E 29th St N, Wichita, KS 67220',
    website: 'https://gpnc.org',
  },
  {
    id: 'boatsbikes',
    name: 'Kayak the Arkansas River',
    kinds: ['outdoors', 'active'],
    blurb: 'Rent a kayak, paddleboard or pedal boat from Boats & Bikes at River Vista downtown. Book online.',
    address: 'Boats and Bikes, River Vista, Wichita, KS',
    website: 'https://book.peek.com/s/123c08db-3352-4b58-b5e7-ca9e8848338b/myaDW',
    months: [5, 6, 7, 8, 9, 10],
  },
  {
    id: 'starlite',
    name: 'Starlite Drive-In',
    kinds: ['outdoors', 'movies'],
    blurb: 'Double features on two screens.',
    address: '3900 S Hydraulic, Wichita, KS 67216',
    website: 'https://www.starlitefun.com',
    months: [3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'fsd',
    name: 'Field Station: Dinosaurs',
    kinds: ['outdoors', 'minigolf'],
    blurb: 'Life-size dinosaurs along a trail, plus Jurassic Golf.',
    address: 'Field Station: Dinosaurs, Derby, KS',
    website: 'https://www.fieldstationdinosaurs.com',
  },
  {
    id: 'meadowlark',
    name: 'Meadowlark Farm',
    kinds: ['outdoors', 'daytrip'],
    blurb: 'Orchard and cidery near Rose Hill pouring hard cider made from apples grown on the farm.',
    address: '11249 SW 160th St, Rose Hill, KS 67133',
    website: 'https://meadowlark-farm-orchard-cid.locable.com',
  },
  {
    id: 'blvdtownewest',
    name: 'Boulevard Theatres Towne West',
    kinds: ['movies'],
    blurb: 'Local movie theater at Towne West Square.',
    address: '4600 W Kellogg Dr, Wichita, KS 67209',
  },
  {
    id: 'blvdoldtown',
    name: 'Boulevard Theatres Old Town',
    kinds: ['movies'],
    blurb: 'The old Warren Old Town theater, reopened by local owners Boulevard.',
    address: '353 S Mead St, Wichita, KS 67202',
  },
  {
    id: 'regaleast',
    name: 'Regal Warren East',
    kinds: ['movies'],
    blurb: '20 screens on East 13th, the old Warren East.',
    address: '11611 E 13th St N, Wichita, KS 67206',
    website: 'https://www.regmovies.com',
  },
  {
    id: 'regalwest',
    name: 'Regal Warren West',
    kinds: ['movies'],
    blurb: 'West-side movie theater on 21st Street.',
    address: '9150 W 21st St N, Wichita, KS 67205',
    website: 'https://www.regmovies.com',
  },
  {
    id: 'cosmosphere',
    name: 'Cosmosphere',
    kinds: ['daytrip', 'museums'],
    blurb: 'Huge space museum in Hutchinson, about an hour away.',
    address: '1100 N Plum St, Hutchinson, KS',
    website: 'https://cosmo.org',
  },
  {
    id: 'strataca',
    name: 'Strataca',
    kinds: ['daytrip', 'museums'],
    blurb: 'Go 650 feet underground in a working salt mine in Hutchinson.',
    address: 'Strataca, Hutchinson, KS',
    website: 'https://underkansas.org',
  },
  {
    id: 'hedricks',
    name: 'Hedrick’s Exotic Animal Farm',
    kinds: ['daytrip', 'animals'],
    blurb: 'Feed giraffes and ride camels near Hutchinson.',
    address: 'Hedrick’s Exotic Animal Farm, Nickerson, KS',
    website: 'https://www.hedricks.com',
  },
];

/** This month in Wichita, 1–12. */
const thisMonth = () => Number(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'numeric' }));

export const inSeason = (a: Activity, month = thisMonth()) => !a.months || a.months.includes(month);

/** Seasonal spots open right now, for the "In season" chip. */
export const seasonalNow = (month = thisMonth()) => ACTIVITIES.filter((a) => a.months?.includes(month));

/**
 * A random activity of this kind (any kind when null; 'season' for seasonal spots open now), skipping the ones
 * already shown. Out-of-season spots never come up.
 */
export function randomActivity(kind: ActivityKind | 'season' | null, skip: string[] = []) {
  const pool = ACTIVITIES.filter(
    (a) =>
      inSeason(a) && (kind === 'season' ? !!a.months : !kind || a.kinds.includes(kind)) && !skip.includes(a.id),
  );
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
