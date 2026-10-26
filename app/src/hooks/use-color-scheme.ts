/**
 * The app is light-only for now, even when the phone or computer is set to dark mode.
 * To follow the device again: `export { useColorScheme } from 'react-native';` (and set
 * userInterfaceStyle back to "automatic" in app.json).
 */
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
