import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Screen, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { posthog, track } from '@/lib/analytics';

/**
 * The one link to share for the app: app.wichitalifeict.com/get?from=newsletter (or instagram, flyer…).
 * Counts the tap by source, then sends iPhones to the App Store and Android phones to Google Play, each
 * tagged with the source so App Store Connect and the Play Console can count installs by it. Computers
 * get both store buttons and a QR code. On a phone that already has the app, the link opens the app.
 */
const APP_STORE_ID = '6829788602';
// App Store Connect → Analytics → Campaigns shows this "provider token" (pt=…) in any campaign link it makes.
// Without it, App Store Connect can't credit installs to a campaign; the link still works.
const APPLE_PROVIDER_TOKEN = '129726418';
// Turn on once Google Play has approved the app; until then Android visitors are offered the web app.
const ON_GOOGLE_PLAY = false;
const ANDROID_PACKAGE = 'com.wichitalifeict.app';

type Device = 'ios' | 'android' | 'desktop';

const appStoreUrl = (from: string) =>
  `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?${APPLE_PROVIDER_TOKEN ? `pt=${APPLE_PROVIDER_TOKEN}&` : ''}ct=${from}&mt=8`;
const playUrl = (from: string) =>
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${encodeURIComponent(
    `utm_source=${from}&utm_medium=link&utm_campaign=${from}`,
  )}`;

/** Letters, numbers, - and _ only, so the source can't break a store link. */
const cleanSource = (raw?: string | string[]) =>
  (Array.isArray(raw) ? raw[0] : raw ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'direct';

function webDevice(): Device {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  // iPads say "Macintosh" now; a Mac with a touch screen is an iPad.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** Gives PostHog a moment to send the tap before the page leaves for the store. */
const sendNow = () => Promise.race([posthog?.flush(), new Promise((r) => setTimeout(r, 800))]);

export default function GetTheApp() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ from?: string }>();
  const from = cleanSource(params.from);
  // The website is a single page drawn in the browser, so the browser is known from the first draw.
  const [device] = useState<Device | undefined>(() => (Platform.OS === 'web' ? webDevice() : undefined));

  useEffect(() => {
    if (!device) {
      // The link opened the app itself (it's already installed): count it and go home.
      track('app_link_opened', { from, device: Platform.OS === 'ios' ? 'ios' : 'android' });
      router.replace('/');
      return;
    }
    track('app_link_opened', { from, device });
    if (device === 'ios' || (device === 'android' && ON_GOOGLE_PLAY)) {
      sendNow().then(() => window.location.replace(device === 'ios' ? appStoreUrl(from) : playUrl(from)));
    }
  }, [from, device]);

  const goStore = (store: 'app_store' | 'google_play') => {
    track('app_store_tapped', { from, store });
    sendNow().then(() => (window.location.href = store === 'app_store' ? appStoreUrl(from) : playUrl(from)));
  };
  const leaving = device === 'ios' || (device === 'android' && ON_GOOGLE_PLAY);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <Screen>
        <Sticker color={Brand.orange} shadow={Brand.blue}>
          <T variant="script" color={Brand.navy}>
            Hey, Wichita.
          </T>
          <T variant="heading" color={Brand.navy}>
            Get the Wichita Life app
          </T>
          <T color={Brand.navy}>
            Every event and live show in town, giveaways from local spots, and plans with friends. Free.
          </T>
        </Sticker>

        {!device || leaving ? (
          <T>{device === 'ios' ? 'Opening the App Store…' : device ? 'Opening Google Play…' : ''}</T>
        ) : null}

        {device === 'ios' ? (
          <Button tone="red" label="Open the App Store" onPress={() => goStore('app_store')} />
        ) : null}

        {device === 'android' ? (
          ON_GOOGLE_PLAY ? (
            <Button tone="red" label="Open Google Play" onPress={() => goStore('google_play')} />
          ) : (
            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">Coming soon to Google Play</T>
              <T>The Android app is almost here. In the meantime, everything works right here in your browser.</T>
              <Button tone="red" label="Use Wichita Life in my browser" onPress={() => router.replace('/')} />
            </Card>
          )
        ) : null}

        {device === 'desktop' ? (
          <>
            <View style={{ gap: Spacing.two }}>
              <Button tone="red" label="Download on the App Store" onPress={() => goStore('app_store')} />
              {ON_GOOGLE_PLAY ? (
                <Button tone="navy" label="Get it on Google Play" onPress={() => goStore('google_play')} />
              ) : (
                <T variant="small">Android: coming soon to Google Play.</T>
              )}
            </View>
            <Card style={{ alignItems: 'center', gap: Spacing.two }}>
              <T variant="cardTitle">On your phone? Scan this</T>
              <QRCode
                value={`https://app.wichitalifeict.com/get?from=${from}`}
                size={180}
                color={Brand.navy}
                backgroundColor={Brand.white}
              />
            </Card>
            <Button tone="ghost" label="Or use it here in your browser" onPress={() => router.replace('/')} />
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
