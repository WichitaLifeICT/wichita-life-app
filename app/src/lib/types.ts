/** Row shapes for the tables in supabase/migrations. Keep in sync with the SQL. */

export type PostKind = 'daily' | 'deep' | 'weekend' | 'spotlight' | 'guide';

export type Post = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  url: string;
  kind: PostKind;
  excerpt: string | null;
  thumbnail_url: string | null;
  featured: boolean;
  published_at: string;
};

export type EventItem = {
  id: string;
  source: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  venue: string | null;
  address: string | null;
  price_text: string | null;
  url: string | null;
  image_url: string | null;
  tags: string[];
  /** The calendar's own tags ("Live Music", "Rock", "Date Night"…), from sync-events. */
  calendar_tags: string[];
  is_sponsored: boolean;
};

export type NewsItem = {
  id: string;
  source_name: string;
  title: string;
  url: string;
  published_at: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  url: string;
  pay_text: string | null;
  location: string | null;
  job_type: string | null;
  posted_at: string;
};

export type Sponsor = {
  id: string;
  name: string;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export type Meetup = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  area: string;
  capacity: number;
  going: number;
  /** Hosted elsewhere: the button opens this sign-up page instead of RSVPing in the app. */
  signup_url: string | null;
  /** The Wichita Life group it's for, if any. */
  group: { name: string; slug: string } | null;
};

export type Group = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  members: number;
};

export type ThreadCategory = 'recommendations' | 'ask' | 'free_for_sale' | 'lost_found';

export type Thread = {
  id: string;
  author_id: string;
  category: ThreadCategory;
  title: string;
  body: string;
  status: 'pending' | 'approved' | 'removed';
  created_at: string;
  author_name: string;
  replies: number;
};

export type Reply = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

export type Giveaway = {
  id: string;
  title: string;
  prize: string;
  description: string | null;
  sponsor_name: string | null;
  ends_at: string;
  rules_url: string;
  entrants: number;
};

export type Guide = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  url: string;
  position: number;
  updated_at: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  interests: string[];
  role: 'member' | 'moderator' | 'admin';
  onboarded_at: string | null;
  referral_code: string;
  created_at: string;
};

export type NotificationPrefs = {
  daily: boolean;
  giveaways: boolean;
  weekend: boolean;
  breaking: boolean;
};
