/** What members pick during onboarding (and can change on the Account page), saved to profiles.interests. */
export const INTERESTS = [
  { id: 'music', label: '♫ Live music' },
  { id: 'food', label: '🍔 Food & drink' },
  { id: 'family', label: '👨‍👩‍👧 Family & kids' },
  { id: 'arts', label: '🎨 Arts & culture' },
  { id: 'outdoors', label: '🌳 Outdoors' },
  { id: 'sports', label: '🏈 Sports' },
  { id: 'nightlife', label: '🍸 Nightlife' },
  { id: 'festivals', label: '🎪 Festivals & markets' },
  { id: 'games', label: '🧩 Games & trivia' },
  { id: 'meetups', label: '👋 Meeting people' },
  { id: 'news', label: '📰 Local news' },
  { id: 'giveaways', label: '🎁 Giveaways' },
] as const;

export type InterestId = (typeof INTERESTS)[number]['id'];
