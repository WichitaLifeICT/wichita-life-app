/** Wichita Life Games (games.wichitalifeict.com). Each game is a section of that one page. */
export const GAMES_URL = 'https://games.wichitalifeict.com';

export type GameId = 'wheatle' | 'crossroads' | 'troll';

export const GAMES: { id: GameId; title: string; emoji: string; blurb: string; cadence: string }[] = [
  {
    id: 'wheatle',
    title: 'Wheatle',
    emoji: '🌾',
    blurb: 'Five letters, six guesses. Every answer means something in ICT.',
    cadence: 'New every morning',
  },
  {
    id: 'crossroads',
    title: 'Crossroads',
    emoji: '▦',
    blurb: 'A crossword pulled from Wichita history, streets and lore.',
    cadence: 'New every Friday',
  },
  {
    id: 'troll',
    title: 'Troll Patrol',
    emoji: '🛁',
    blurb: 'Thirty seconds down the Arkansas in a bathtub. Grab trash, dodge geese.',
    cadence: 'Arcade · high scores',
  },
];

/** `app=1` lets the games site trim its own header and footer when shown inside the app. */
export const gameUrl = (id: GameId) => `${GAMES_URL}/?app=1#${id}`;

export const isGameId = (id: unknown): id is GameId => GAMES.some((g) => g.id === id);
