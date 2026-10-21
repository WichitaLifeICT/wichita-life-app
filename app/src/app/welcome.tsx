import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Screen, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { INTERESTS } from '@/lib/interests';
import { updateProfile } from '@/lib/member';
import { enablePush, getPushPermission } from '@/lib/push';

type Step = 'welcome' | 'interests' | 'notifications';

const WHAT_YOU_GET = [
  ['📅', 'Every event and live show in town, in one place'],
  ['🎁', 'Giveaways from local spots, with bonus entries'],
  ['👋', 'Meetups and a community board for Wichitans'],
  ['🗳️', 'Vote on Wichita’s best coffee, tacos and more'],
] as const;

/** Shown once after a new member signs up: what's here, what they're into, and notifications. */
export default function Welcome() {
  const theme = useTheme();
  const track = useTrack();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [picked, setPicked] = useState<string[]>(() => profile?.interests ?? []);
  const [askPush, setAskPush] = useState(false);
  const [busy, setBusy] = useState(false);

  // Only ask about notifications on phones that haven't been asked yet.
  useEffect(() => {
    getPushPermission().then((p) => setAskPush(p === 'undetermined'));
  }, []);

  useEffect(() => {
    track('onboarding_step_viewed', { step });
  }, [step, track]);

  const finish = async (notifications: boolean, skipped = false) => {
    setBusy(true);
    track('onboarding_completed', { interests: picked, notifications, skipped });
    try {
      await updateProfile({ interests: picked, onboarded: true });
      await refreshProfile();
    } catch {
      // Not worth blocking anyone over; they can set interests on the Account page.
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const afterInterests = () => (askPush ? setStep('notifications') : finish(false));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" hitSlop={12} disabled={busy} onPress={() => finish(false, true)}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Skip
          </T>
        </Pressable>
      </View>
      <Screen>
        {step === 'welcome' ? (
          <>
            <Sticker color={Brand.orange} shadow={Brand.blue}>
              <T variant="script" color={Brand.navy}>
                {firstName ? `Welcome, ${firstName}!` : 'Welcome, Wichita!'}
              </T>
              <T variant="heading" color={Brand.navy}>
                Your city, all in one app
              </T>
              <T color={Brand.navy}>From the team behind the Wichita Life newsletter.</T>
            </Sticker>
            <View style={{ gap: Spacing.three }}>
              {WHAT_YOU_GET.map(([icon, text]) => (
                <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <T style={{ fontSize: 26 }}>{icon}</T>
                  <T style={{ flex: 1 }}>{text}</T>
                </View>
              ))}
            </View>
            <Button tone="red" label="Let’s go" onPress={() => setStep('interests')} />
          </>
        ) : null}

        {step === 'interests' ? (
          <>
            <View style={{ gap: Spacing.one }}>
              <T variant="heading">What are you into?</T>
              <T>Pick a few and we’ll put more of it in front of you. You can change these anytime.</T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              {INTERESTS.map((i) => (
                <Chip key={i.id} label={i.label} active={picked.includes(i.id)} onPress={() => toggle(i.id)} />
              ))}
            </View>
            <Button
              tone="red"
              label={picked.length ? 'Next' : 'Skip for now'}
              disabled={busy}
              onPress={afterInterests}
            />
          </>
        ) : null}

        {step === 'notifications' ? (
          <>
            <Sticker color={Brand.blue} shadow={Brand.orange}>
              <T style={{ fontSize: 34 }}>🔔</T>
              <T variant="heading" color={Brand.white}>
                Don’t miss the good stuff
              </T>
              <T color="#EAF0FA">
                A heads-up when a giveaway opens, your weekend guide on Thursday morning, and a reminder the night
                before events you save. Change what you get anytime on your Account page.
              </T>
            </Sticker>
            <Button
              tone="red"
              label="Turn on notifications"
              disabled={busy}
              onPress={async () => finish(await enablePush('onboarding'))}
            />
            <Button tone="ghost" label="Not now" disabled={busy} onPress={() => finish(false)} />
          </>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.two }}>
          {(['welcome', 'interests', ...(askPush ? ['notifications'] : [])] as Step[]).map((s) => (
            <View
              key={s}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: s === step ? Brand.red : theme.line,
              }}
            />
          ))}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
