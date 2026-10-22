// How each interest members pick (app/src/lib/interests.ts) shows up in event tags. Keep in step
// with INTEREST_MATCH in app/src/lib/events.ts, which does the same for Picked for you in the app.

export type TaggedEvent = { tags: string[]; calendar_tags: string[] | null };

const has = (e: TaggedEvent, ours: string, ...calendar: string[]) =>
  e.tags.includes(ours) || calendar.some((t) => e.calendar_tags?.includes(t));

export const INTEREST_MATCH: Record<string, (e: TaggedEvent) => boolean> = {
  music: (e) => has(e, 'music', 'Live Music'),
  food: (e) =>
    has(e, 'food', 'Food', 'Eat', 'Dinner', 'Brunch', 'Lunch', 'Drinks', 'Craft Beer', 'Wine Lovers', 'Whiskey Lovers'),
  family: (e) => has(e, 'family', 'Family Friendly'),
  arts: (e) => has(e, 'arts', 'Performing Arts', 'Museum', 'Local Artisans', 'Crafty', 'Workshop'),
  outdoors: (e) => has(e, 'outdoors', 'Outdoor', 'Nature', 'Walking', 'Scenic Views'),
  sports: (e) => has(e, 'sports', 'Sport', 'Watching Sports'),
  nightlife: (e) => has(e, 'nightlife', 'Late Night', 'Dancing', 'Comedy', 'Date Night', 'Dj', 'Karaoke', 'Dive Bar'),
  festivals: (e) => has(e, 'festivals', 'Festival', 'Market', 'Seasonal'),
  games: (e) => has(e, 'games', 'Games', 'Trivia'),
  meetups: (e) => has(e, 'meetups', 'Make Friends', 'Local Groups'),
};

/** How many of these interests the event fits. */
export const interestScore = (e: TaggedEvent, interests: string[]) =>
  interests.filter((i) => INTEREST_MATCH[i]?.(e)).length;
