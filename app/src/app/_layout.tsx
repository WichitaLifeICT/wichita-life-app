import { CaveatBrush_400Regular } from '@expo-google-fonts/caveat-brush';
import { OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold } from '@expo-google-fonts/open-sans';
import { Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, type ReactNode } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { posthog } from '@/lib/analytics';
import { AuthProvider } from '@/lib/auth';
import { useReferralCapture } from '@/lib/referral';

SplashScreen.preventAutoHideAsync();

function ReferralCapture() {
  useReferralCapture();
  return null;
}

function Analytics({ children }: { children: ReactNode }) {
  if (!posthog) return children;
  return (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: true }}>
      {children}
    </PostHogProvider>
  );
}

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
        <ReferralCapture />
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="jobs" />
            <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
            <Stack.Screen name="account" options={{ presentation: 'modal' }} />
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="new-post" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin" />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </Analytics>
  );
}
