import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, Screen, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendEmailLink, signInWithGoogle, useAuth, verifyEmailCode } from '@/lib/auth';
import { updateProfile } from '@/lib/member';

type Step = 'start' | 'sent' | 'name';

export default function SignIn() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const theme = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Once signed in: ask for a name if we don't have one, otherwise go back to what they were doing.
  const needsName = Boolean(session && profile && !profile.display_name);
  useEffect(() => {
    if (session && profile && profile.display_name) close();
  }, [session, profile]);
  const shownStep: Step = needsName ? 'name' : step;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          paddingHorizontal: Spacing.three,
          paddingTop: Spacing.two,
          alignItems: 'flex-end',
        }}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={12}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            {needsName ? 'Skip' : 'Close'}
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <Sticker color={Brand.orange} shadow={Brand.blue}>
            <T variant="script" color={Brand.navy}>
              Hey, Wichita.
            </T>
            <T variant="heading" color={Brand.navy}>
              {shownStep === 'name' ? 'What should we call you?' : reason || 'Sign in to Wichita Life'}
            </T>
            <T color={Brand.navy}>
              {shownStep === 'name'
                ? 'Your first name and last initial show on the community board, like “Ana L.”'
                : 'Save events, enter giveaways, RSVP to meetups and post on the community board.'}
            </T>
          </Sticker>

          {shownStep === 'start' ? (
            <View style={{ gap: Spacing.three }}>
              <Button tone="ghost" label="Continue with Google" disabled={busy} onPress={() => run(signInWithGoogle)} />
              <T variant="small">or use your email</T>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                returnKeyType="send"
                onSubmitEditing={() => validEmail && run(async () => (await sendEmailLink(email), setStep('sent')))}
              />
              <Button
                tone="red"
                label={busy ? 'Sending…' : 'Email me a sign-in link'}
                disabled={busy || !validEmail}
                onPress={() => run(async () => (await sendEmailLink(email), setStep('sent')))}
              />
            </View>
          ) : null}

          {shownStep === 'sent' ? (
            <View style={{ gap: Spacing.three }}>
              <T>
                Check <T style={{ fontFamily: Fonts.bodyBold }}>{email.trim()}</T> and tap the link on this device. Or
                type the 6-digit code from the email:
              </T>
              <Field
                label="Code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
              />
              <Button
                tone="red"
                label={busy ? 'Checking…' : 'Sign in'}
                disabled={busy || code.length !== 6}
                onPress={() => run(() => verifyEmailCode(email, code))}
              />
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Button
                  small
                  tone="ghost"
                  label="Resend"
                  disabled={busy}
                  onPress={() => run(() => sendEmailLink(email))}
                />
                <Button
                  small
                  tone="ghost"
                  label="Use a different email"
                  onPress={() => (setStep('start'), setCode(''))}
                />
              </View>
            </View>
          ) : null}

          {shownStep === 'name' ? (
            <View style={{ gap: Spacing.three }}>
              <Field
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Ana L."
                autoComplete="name"
                maxLength={40}
                returnKeyType="done"
              />
              <Button
                tone="red"
                label="Save"
                disabled={busy || name.trim().length < 2}
                onPress={() =>
                  run(async () => (await updateProfile({ display_name: name.trim() }), await refreshProfile()))
                }
              />
            </View>
          ) : null}

          {error ? (
            <T variant="small" color={Brand.red}>
              {error}
            </T>
          ) : null}

          <T variant="small">
            By continuing you agree to the{' '}
            <T variant="small" color={Brand.red} onPress={() => router.push('/terms')}>
              Terms & Community Guidelines
            </T>{' '}
            and{' '}
            <T variant="small" color={Brand.red} onPress={() => router.push('/privacy')}>
              Privacy Policy
            </T>
            . We never sell your email or show it to other members.
          </T>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
