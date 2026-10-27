import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Field, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { sendFeedback, type FeedbackKind } from '@/lib/feedback';

const KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: 'idea', label: 'Idea', hint: 'What would make Wichita Life better for you?' },
  { id: 'bug', label: 'Something’s broken', hint: 'What happened, and where in the app?' },
  { id: 'love', label: 'I love…', hint: 'What’s working for you? We’ll do more of it.' },
  { id: 'other', label: 'Other', hint: 'What’s on your mind?' },
];

export default function Feedback() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const hint = KINDS.find((k) => k.id === kind)!.hint;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await sendFeedback({ kind, message, contactEmail: session ? undefined : email, screen: from });
      track('feedback_sent', { kind });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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
        <T variant="title">Send feedback</T>
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
              <T variant="cardTitle">Thank you!</T>
              <T variant="small">
                The Wichita Life team reads every note.{' '}
                {session || email ? 'If we have a question, we’ll get back to you.' : ''}
              </T>
              <Button tone="red" label="Back to the app" onPress={() => router.back()} />
            </Card>
          ) : (
            <View style={{ gap: Spacing.three }}>
              <T>We’re building this for Wichita, so tell us what you think. Every note gets read.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {KINDS.map((k) => (
                  <Chip key={k.id} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
                ))}
              </View>
              <Field
                label="Your feedback"
                value={message}
                onChangeText={setMessage}
                placeholder={hint}
                multiline
                maxLength={4000}
                style={{ minHeight: 140, textAlignVertical: 'top' }}
              />
              {session ? (
                <T variant="small">Sent from your account, so we can follow up if needed.</T>
              ) : (
                <Field
                  label="Email (optional, if you’d like a reply)"
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
                label={busy ? 'Sending…' : 'Send feedback'}
                disabled={busy || message.trim().length < 3}
                onPress={submit}
              />
            </View>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
