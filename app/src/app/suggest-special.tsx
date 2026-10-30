import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/lib/format';
import { Button, Chip, Field, Screen, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useRequireSignIn } from '@/lib/auth';
import { DAY_SHORT, KINDS, parseTime, suggestWeekly, type WeeklyKind } from '@/lib/weekly';

/** Members tell us about a happy hour, trivia night or other weekly regular; staff approve it. */
export default function SuggestSpecial() {
  const theme = useTheme();
  const track = useTrack();
  const requireSignIn = useRequireSignIn();
  const [kind, setKind] = useState<WeeklyKind>('happy_hour');
  const [venue, setVenue] = useState('');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/events', params: { view: 'weekly' } }));

  const send = async () => {
    if (!requireSignIn('Sign in to suggest a special')) return;
    const s = parseTime(starts);
    const e = parseTime(ends);
    if (s === undefined || e === undefined) return setError('Times look like 4pm or 6:30pm');
    setBusy(true);
    setError(undefined);
    try {
      await suggestWeekly({
        kind,
        venue: venue.trim(),
        title: title.trim(),
        days: [...days].sort(),
        starts: s,
        ends: s ? e : null,
        details: details.trim() || null,
      });
      track('weekly_suggested', { kind });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const valid = venue.trim().length >= 2 && title.trim().length >= 2 && days.length > 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={close}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Close
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          {sent ? (
            <>
              <Sticker color={Brand.orange} shadow={Brand.blue}>
                <T variant="heading" color={Brand.navy}>
                  Thanks! 🍻
                </T>
                <T color={Brand.navy}>We’ll double-check it and add it to Weekly specials.</T>
              </Sticker>
              <Button tone="red" label="Done" onPress={close} />
              <Button
                tone="ghost"
                label="Suggest another"
                onPress={() => {
                  setSent(false);
                  setVenue('');
                  setTitle('');
                  setDetails('');
                }}
              />
            </>
          ) : (
            <>
              <View style={{ gap: Spacing.one }}>
                <T variant="heading">Suggest a weekly special</T>
                <T>A happy hour, trivia night or other regular we’re missing? Tell us and we’ll add it.</T>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {KINDS.map((k) => (
                  <Chip key={k.id} label={`${k.icon} ${k.label}`} active={kind === k.id} onPress={() => setKind(k.id)} />
                ))}
              </View>
              <Field label="Where" value={venue} onChangeText={setVenue} placeholder="Name of the place" maxLength={120} />
              <Field
                label="What's the deal"
                value={title}
                onChangeText={setTitle}
                placeholder="$3 wells, half-price apps"
                maxLength={120}
              />
              <T variant="label">Which days</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                {DAY_SHORT.map((d, i) => (
                  <Chip
                    key={d}
                    label={d}
                    active={days.includes(i)}
                    onPress={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <View style={{ flex: 1 }}>
                  <Field label="Starts" value={starts} onChangeText={setStarts} placeholder="4pm" autoCapitalize="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Ends" value={ends} onChangeText={setEnds} placeholder="6pm" autoCapitalize="none" />
                </View>
              </View>
              <Field
                label="Anything else (optional)"
                value={details}
                onChangeText={setDetails}
                placeholder="Bar only. Trivia starts at 7, teams up to 6."
                multiline
                maxLength={500}
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
              {error ? <T color={Brand.redText}>{error}</T> : null}
              <Button tone="red" label={busy ? 'Sending…' : 'Send it'} disabled={busy || !valid} onPress={send} />
            </>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
