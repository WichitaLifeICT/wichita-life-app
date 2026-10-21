import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/lib/auth';

// Don't interrupt signing in or a game in progress; the welcome waits until they're back.
const NOT_NOW = ['/welcome', '/sign-in', '/auth-callback'];

/** Opens the welcome screens once for members who have a name but haven't been through them. */
export function useOnboardingPrompt() {
  const { session, profile } = useAuth();
  const pathname = usePathname();
  const shown = useRef(false);
  const due = Boolean(session && profile?.display_name && !profile.onboarded_at);
  const wait = NOT_NOW.includes(pathname) || pathname.startsWith('/game');

  useEffect(() => {
    if (!due || wait || shown.current) return;
    // A moment's pause lets the sign-in sheet finish closing first.
    const t = setTimeout(() => {
      shown.current = true;
      router.push('/welcome');
    }, 600);
    return () => clearTimeout(t);
  }, [due, wait]);
}
