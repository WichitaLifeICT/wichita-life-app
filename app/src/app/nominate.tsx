import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { nominateSpotlight } from '@/lib/feedback';

export default function Nominate() {
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const [who, setWho] = useState('');
  const [why, setWhy] = useState('');
  const [link, setLink] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await nominateSpotlight({ who, why, link, contactEmail: session ? undefined : email });
      track('spotlight_nominated', { signed_in: !!session });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setWho('');
    setWhy('');
    setLink('');
    setSent(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          paddingHorizontal: Spacing.three,
          paddingTop: Spacing.two,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        <T variant="title">Nominate a Spotlight</T>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            {sent ? 'Done' : 'Cancel'}
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          {sent ? (
            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">Thanks for the nomination!</T>
              <T variant="small">
                The Wichita Life team reads every one.{' '}
                {session || email ? 'If we feature them, we’ll let you know.' : ''}
              </T>
              <Button tone="red" label="Back to the app" onPress={() => router.back()} />
              <Button tone="ghost" label="Nominate someone else" onPress={reset} />
            </Card>
          ) : (
            <View style={{ gap: Spacing.three }}>
              <T>
                Know a Wichitan, small business, or group doing something great? Tell us who they are and why they
                deserve a Spotlight. You can nominate yourself, too.
              </T>
              <Field
                label="Who are you nominating?"
                value={who}
                onChangeText={setWho}
                placeholder="A person, business, or group"
                maxLength={200}
              />
              <Field
                label="Why should we feature them?"
                value={why}
                onChangeText={setWhy}
                placeholder="What they do, what makes them special, how you know them"
                multiline
                maxLength={3000}
                style={{ minHeight: 140, textAlignVertical: 'top' }}
              />
              <Field
                label="Their website or social (optional)"
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                inputMode="url"
                placeholder="instagram.com/…"
                maxLength={300}
              />
              {session ? (
                <T variant="small">Sent from your account, so we can follow up if needed.</T>
              ) : (
                <Field
                  label="Your email (optional, so we can follow up)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  inputMode="email"
                  placeholder="you@example.com"
                />
              )}
              {error ? (
                <T variant="small" color={Brand.redText}>
                  {error}
                </T>
              ) : null}
              <Button
                tone="red"
                label={busy ? 'Sending…' : 'Send nomination'}
                disabled={busy || who.trim().length < 2 || why.trim().length < 3}
                onPress={submit}
              />
            </View>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
