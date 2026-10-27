import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Field, Screen, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useRequireSignIn } from '@/lib/auth';
import { CLUB_CATEGORIES, normalizeUrl, suggestClub, suggestGroup, type ClubCategory } from '@/lib/clubs';

type Kind = 'club' | 'group';

/**
 * Members add a club that already exists around town (with its link), or propose a new
 * Wichita Life interest group. Both wait for staff approval before they show on Meet.
 */
export default function SuggestClub() {
  const theme = useTheme();
  const track = useTrack();
  const requireSignIn = useRequireSignIn();
  const params = useLocalSearchParams<{ type?: Kind }>();
  const [kind, setKind] = useState<Kind>(params.type === 'group' ? 'group' : 'club');
  const [category, setCategory] = useState<ClubCategory>('run');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [schedule, setSchedule] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/meet'));

  const link = normalizeUrl(url);
  const linkOk = /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(link);
  const valid = name.trim().length >= 2 && (kind === 'group' ? description.trim().length >= 5 : linkOk);

  const send = async () => {
    if (!requireSignIn('Sign in to add a club or group')) return;
    setBusy(true);
    setError(undefined);
    try {
      if (kind === 'club') {
        await suggestClub({
          name: name.trim(),
          category,
          url: link,
          schedule: schedule.trim() || null,
          description: description.trim() || null,
        });
        track('club_suggested', { type: 'club', category });
      } else {
        await suggestGroup(name.trim(), description.trim());
        track('club_suggested', { type: 'group' });
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSent(false);
    setName('');
    setUrl('');
    setSchedule('');
    setDescription('');
  };

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
                  Thanks! 🙌
                </T>
                <T color={Brand.navy}>
                  {kind === 'club'
                    ? 'We’ll take a look and add it to Clubs around town.'
                    : 'We’ll take a look, and if it’s a fit we’ll open the group on Meet.'}
                </T>
              </Sticker>
              <Button tone="red" label="Done" onPress={close} />
              <Button tone="ghost" label="Add another" onPress={reset} />
            </>
          ) : (
            <>
              <View style={{ gap: Spacing.one }}>
                <T variant="heading">{kind === 'club' ? 'Add a club' : 'Start a group'}</T>
                <T>
                  {kind === 'club'
                    ? 'A run club, game night, book club or other group that already meets in Wichita? Tell us where to find them.'
                    : 'Want a Wichita Life group around an interest? Pitch it and we’ll open it for members to join.'}
                </T>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Chip label="A club that already exists" active={kind === 'club'} onPress={() => setKind('club')} />
                <Chip label="A new group on the app" active={kind === 'group'} onPress={() => setKind('group')} />
              </View>
              {kind === 'club' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                  {CLUB_CATEGORIES.map((c) => (
                    <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} />
                  ))}
                </View>
              ) : null}
              <Field
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder={kind === 'club' ? 'Run 316' : 'Pickup soccer'}
                maxLength={80}
              />
              {kind === 'club' ? (
                <>
                  <Field
                    label="Instagram, Facebook or website"
                    value={url}
                    onChangeText={setUrl}
                    placeholder="instagram.com/run__316"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    maxLength={300}
                  />
                  <Field
                    label="When and where they meet (optional)"
                    value={schedule}
                    onChangeText={setSchedule}
                    placeholder="Saturdays 8am at Greater Grounds"
                    maxLength={200}
                  />
                </>
              ) : null}
              <Field
                label={kind === 'club' ? 'Anything else (optional)' : 'What’s it about'}
                value={description}
                onChangeText={setDescription}
                placeholder={kind === 'club' ? 'All paces welcome, coffee after.' : 'Casual Sunday games at local parks, all skill levels.'}
                multiline
                maxLength={300}
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
