/**
 * Community votes ("Best coffee in Wichita"). The database decides who can vote, when, and who
 * can see the split (members who voted, everyone once it closes, staff), so the app just asks.
 */
import { supabase } from '@/lib/supabase';

export type PollOption = { id: string; label: string; status: 'pending' | 'approved' | 'removed' };

export type Poll = {
  id: string;
  question: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  allow_suggestions: boolean;
  vote_count: number;
  /** Today's "Question of the day" rather than a Wichita vote. */
  daily: boolean;
  options: PollOption[];
};

export type PollResult = { option_id: string; label: string; votes: number };

export type PollState = {
  poll: Poll;
  open: boolean;
  /** The option this member picked, if signed in and voted. */
  myVote: string | null;
  /** Your suggestions still waiting on staff. */
  mySuggestions: string[];
  /** Per-option counts, once you're allowed to see them. */
  results: PollResult[] | null;
};

function db() {
  if (!supabase) throw new Error('Supabase is not connected yet.');
  return supabase;
}

const POLL_FIELDS =
  'id, question, description, starts_at, ends_at, allow_suggestions, vote_count, daily, options:poll_options(id, label, status)';

export async function getPollResults(pollId: string): Promise<PollResult[]> {
  const { data, error } = await db().rpc('poll_results', { poll: pollId });
  if (error) throw error;
  return data;
}

async function withState(poll: Poll, userId: string | undefined, now: number): Promise<PollState> {
  const open = Date.parse(poll.starts_at) <= now && now < Date.parse(poll.ends_at);
  let myVote: string | null = null;
  if (userId) {
    const { data } = await db().from('poll_votes').select('option_id').eq('poll_id', poll.id).eq('user_id', userId);
    myVote = data?.[0]?.option_id ?? null;
  }
  const results = myVote || !open ? await getPollResults(poll.id) : null;
  return {
    poll: { ...poll, options: poll.options.filter((o) => o.status === 'approved') },
    open,
    myVote,
    mySuggestions: poll.options.filter((o) => o.status === 'pending').map((o) => o.label),
    results,
  };
}

/** The open vote (the one closing soonest) and a few recent results. */
export async function getPolls(): Promise<{ current: PollState | null; past: PollState[] }> {
  const { data: session } = await db().auth.getSession();
  const userId = session.session?.user.id;
  const now = Date.now();
  const { data, error } = await db()
    .from('polls')
    .select(POLL_FIELDS)
    .eq('published', true)
    .eq('daily', false)
    .order('ends_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  const polls = data as Poll[];
  const open = polls.filter((p) => Date.parse(p.ends_at) > now).sort((a, b) => a.ends_at.localeCompare(b.ends_at));
  const closed = polls.filter((p) => Date.parse(p.ends_at) <= now && p.vote_count > 0).slice(0, 3);
  const [current, ...past] = await Promise.all([
    open[0] ? withState(open[0], userId, now) : Promise.resolve(null),
    ...closed.map((p) => withState(p, userId, now)),
  ]);
  return { current, past: past as PollState[] };
}

/** Just the open question, for the Today teaser. */
export async function getOpenPoll(): Promise<Pick<Poll, 'id' | 'question' | 'ends_at' | 'vote_count'> | null> {
  const { data, error } = await db()
    .from('polls')
    .select('id, question, ends_at, vote_count')
    .eq('published', true)
    .eq('daily', false)
    .gt('ends_at', new Date().toISOString())
    .order('ends_at')
    .limit(1);
  if (error) throw error;
  return data[0] ?? null;
}

/** Today's question of the day, if there is one. */
export async function getDailyQuestion(): Promise<PollState | null> {
  const { data: session } = await db().auth.getSession();
  const now = new Date();
  const { data, error } = await db()
    .from('polls')
    .select(POLL_FIELDS)
    .eq('published', true)
    .eq('daily', true)
    .lte('starts_at', now.toISOString())
    .gt('ends_at', now.toISOString())
    .order('starts_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const poll = (data as Poll[])[0];
  return poll ? withState(poll, session.session?.user.id, now.getTime()) : null;
}

/** Vote, or change your vote while the poll is open (members may only change which option). */
export async function vote(pollId: string, optionId: string, changing: boolean) {
  const { data } = await db().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in first');
  const { error } = changing
    ? await db().from('poll_votes').update({ option_id: optionId }).eq('poll_id', pollId).eq('user_id', userId)
    : await db().from('poll_votes').insert({ poll_id: pollId, user_id: userId, option_id: optionId });
  if (error) throw error;
}

/** Suggest a missing option; it shows to everyone once staff approve it. */
export async function suggestOption(pollId: string, label: string) {
  const { data } = await db().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in first');
  const { error } = await db()
    .from('poll_options')
    .insert({ poll_id: pollId, label: label.trim(), status: 'pending', suggested_by: userId });
  if (error?.code === '23505') throw new Error('That one is already on the list.');
  if (error?.code === '42501') throw new Error('You can suggest up to 3 per vote.');
  if (error) throw error;
}
