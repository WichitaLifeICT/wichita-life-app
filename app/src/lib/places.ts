/**
 * Places to eat, for "Where should I eat?". Started from OpenStreetMap and curated by staff
 * (Staff tools > Restaurants); the database's random_place() does the picking.
 */
import { supabase } from '@/lib/supabase';

export type Place = {
  id: string;
  name: string;
  kind: 'restaurant' | 'fast_food' | 'cafe' | 'dessert' | 'pub';
  cuisine: string[];
  categories: string[];
  address: string | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  chain: boolean;
  status: 'active' | 'hidden' | 'closed';
  local_pick: boolean;
  note: string | null;
  source: 'osm' | 'staff';
};

/** The cuisine chips, matching the groups sync-places assigns. */
export const EAT_CATEGORIES: { id: string; label: string }[] = [
  { id: 'mexican', label: '🌮 Mexican' },
  { id: 'bbq', label: '🍖 BBQ' },
  { id: 'pizza', label: '🍕 Pizza' },
  { id: 'burgers', label: '🍔 Burgers' },
  { id: 'asian', label: '🍜 Asian' },
  { id: 'breakfast', label: '🥞 Breakfast' },
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'dessert', label: '🍦 Dessert' },
  { id: 'sandwiches', label: '🥪 Sandwiches' },
  { id: 'italian', label: '🍝 Italian' },
  { id: 'mediterranean', label: '🥙 Mediterranean' },
  { id: 'indian', label: '🍛 Indian' },
  { id: 'chicken', label: '🍗 Chicken' },
  { id: 'steak_seafood', label: '🥩 Steak & seafood' },
  { id: 'american', label: '🇺🇸 American' },
];

const PLACE_FIELDS =
  'id, name, kind, cuisine, categories, address, website, phone, opening_hours, chain, status, local_pick, note, source';

/** A random open place, optionally of one cuisine group, skipping ones already shown. */
export async function randomPlace(category: string | null, localOnly: boolean, skip: string[]): Promise<Place | null> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data, error } = await supabase
    .rpc('random_place', { want_category: category, local_only: localOnly, skip })
    .select(PLACE_FIELDS);
  if (error) throw error;
  return (data as Place[])[0] ?? null;
}

/** "Mexican · Tacos", from OpenStreetMap's cuisine values. */
export function cuisineLabel(p: Pick<Place, 'cuisine' | 'kind'>) {
  const words = p.cuisine.slice(0, 2).map((c) => c.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase()));
  if (words.length) return words.join(' · ');
  return { restaurant: 'Restaurant', fast_food: 'Quick bite', cafe: 'Café', dessert: 'Dessert', pub: 'Pub' }[p.kind];
}
