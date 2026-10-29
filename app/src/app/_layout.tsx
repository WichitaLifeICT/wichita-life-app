import { CaveatBrush_400Regular } from '@expo-google-fonts/caveat-brush';
import { OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold } from '@expo-google-fonts/open-sans';
import { Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useGlobalSearchParams, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider, PostHogSurveyProvider } from 'posthog-react-native';
import { useEffect, type ReactNode } from 'react';

import { CrashScreen } from '@/components/crash-screen';
import '@/lib/stale-bundle';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { posthog } from '@/lib/analytics';
import { AuthProvider } from '@/lib/auth';
import { useOnboardingPrompt } from '@/lib/onboarding';
import { usePushNotifications } from '@/lib/push';
import { useReferralCapture } from '@/lib/referral';

SplashScreen.preventAutoHideAsync();

/** App-wide listeners: invite links, push notifications and the one-time welcome. */
function AppEffects() {
  useReferralCapture();
  usePushNotifications();
  useOnboardingPrompt();
  return null;
}

// PostHog's automatic screen tracking doesn't see Expo Router screens, so record each one here.
function ScreenTracker() {
  const pathname = usePathname();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  useEffect(() => {
    posthog?.screen(pathname, id ? { id } : undefined);
  }, [pathname, id]);
  return null;
}

// In-app polls are set up in PostHog (Surveys → New survey → Popover); they show
// here without an app update. Styled to match the app unless a survey sets its own look.
const SURVEY_LOOK = {
  backgroundColor: '#FFFAF1',
  textColor: Brand.navy,
  borderColor: Brand.navy,
  submitButtonColor: Brand.red,
  submitButtonTextColor: Brand.white,
  ratingButtonColor: '#FFFFFF',
  ratingButtonActiveColor: Brand.blue,
  inputBackground: '#FFFFFF',
  inputTextColor: '#1D2433',
  thankYouMessageHeader: 'Thanks, Wichita!',
};

function Analytics({ children }: { children: ReactNode }) {
  if (!posthog) return children;
  return (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false }}>
      <PostHogSurveyProvider client={posthog} defaultSurveyAppearance={SURVEY_LOOK}>
        {children}
      </PostHogSurveyProvider>
    </PostHogProvider>
  );
}

// Any screen that crashes while drawing shows CrashScreen (and reports it) instead of a blank app.
export { CrashScreen as ErrorBoundary };

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    CaveatBrush_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      primary: colors.script,
    },
  };

  return (
    <Analytics>
      <AuthProvider>
        <AppEffects />
        <ScreenTracker />
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="jobs" />
            <Stack.Screen name="game/[id]" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
            <Stack.Screen name="account" options={{ presentation: 'modal' }} />
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="new-post" options={{ presentation: 'modal' }} />
            <Stack.Screen name="thread/[id]" />
            <Stack.Screen name="group/[slug]" />
            <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
            <Stack.Screen name="nominate" options={{ presentation: 'modal' }} />
            <Stack.Screen name="search" options={{ presentation: 'modal' }} />
            <Stack.Screen name="suggest-special" options={{ presentation: 'modal' }} />
            <Stack.Screen name="suggest-club" options={{ presentation: 'modal' }} />
            <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="admin" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="giveaway-rules" />
            <Stack.Screen name="support" />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </Analytics>
  );
}
