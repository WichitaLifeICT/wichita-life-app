/**
 * Wichita Life brand. Colors come from the WL logo (sunflower orange, brick red,
 * prairie blue, navy outline); fonts match the beehiiv site (Poppins + Open Sans)
 * with Caveat Brush standing in for the hand-lettered wordmark.
 */

export const Brand = {
  orange: '#F8BE6A',
  red: '#DC5B5F',
  /** Wichita Red, deepened just enough for small text to stay readable (WCAG AA on white and cream). */
  redText: '#C24A4E',
  blue: '#3D67AF',
  /** Wichita Sky Blue 1 from the brand guide; navy text on it passes WCAG AA. */
  skyBlue: '#6AA1D6',
  navy: '#15294A',
  green: '#3F8F5A',
  white: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    background: '#FFFAF1',
    card: '#FFFFFF',
    text: '#1D2433',
    textSecondary: '#5D6577',
    heading: Brand.navy,
    line: 'rgba(21,41,74,0.14)',
    chip: '#FFF3DF',
    outline: Brand.navy,
    shadow: Brand.blue,
    header: Brand.orange,
    headerText: Brand.navy,
    script: Brand.blue,
    /** Outline on stickers and buttons. */
    ink: Brand.navy,
    /** Red links and small red labels. */
    link: Brand.redText,
    orangeSoft: '#FDE9C8',
    redSoft: '#FBE1E1',
    blueSoft: '#E3EBF7',
    greenSoft: '#E0F1E5',
  },
  // Dark keeps the logo's colors bright (blue bar, orange outlines, coral links) so it has the same
  // life as light mode instead of navy on navy.
  dark: {
    background: '#0F1D33',
    card: '#1B2F54',
    text: '#EEF1F6',
    textSecondary: '#AEB9CC',
    heading: '#FFF3DF',
    line: 'rgba(248,190,106,0.32)',
    chip: '#22396A',
    outline: Brand.orange,
    shadow: Brand.red,
    header: Brand.blue,
    headerText: '#FFFFFF',
    script: Brand.orange,
    ink: '#07101E',
    link: '#FF8C8F',
    orangeSoft: '#3D2F17',
    redSoft: '#3D1F22',
    blueSoft: '#1D2F52',
    greenSoft: '#173524',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Fonts = {
  display: 'Poppins_700Bold',
  displaySemi: 'Poppins_600SemiBold',
  displayHeavy: 'Poppins_800ExtraBold',
  body: 'OpenSans_400Regular',
  bodySemi: 'OpenSans_600SemiBold',
  bodyBold: 'OpenSans_700Bold',
  script: 'CaveatBrush_400Regular',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { card: 14, sticker: 16, pill: 999, button: 10 } as const;

export const MaxContentWidth = 640;
