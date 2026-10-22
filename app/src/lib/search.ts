/** One search across events, places to eat, weekly specials, stories, guides and jobs (search_all in the database). */
import { supabase } from '@/lib/supabase';

export type SearchKind = 'event' | 'place' | 'weekly' | 'story' | 'guide' | 'job';

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  detail: string;
  url: string | null;
  starts_at: string | null;
};

export const KIND_HEADINGS: Record<SearchKind, string> = {
  event: 'Events',
  place: 'Places to eat',
  weekly: 'Weekly specials',
  story: 'Stories',
  guide: 'Guides',
  job: 'Jobs',
};

export async function searchAll(q: string): Promise<SearchHit[]> {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  const { data, error } = await supabase.rpc('search_all', { q });
  if (error) throw error;
  return data as SearchHit[];
}
