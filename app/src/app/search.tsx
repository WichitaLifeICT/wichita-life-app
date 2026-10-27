import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, ChipRow, Field, PressableCard, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { openDirections } from '@/lib/event-actions';
import { shortDay, timeLabel } from '@/lib/format';
import { openLink } from '@/lib/links';
import { KIND_HEADINGS, searchAll, type SearchHit, type SearchKind } from '@/lib/search';

const ORDER: SearchKind[] = ['event', 'place', 'weekly', 'story', 'guide', 'job'];
const IDEAS = ['live music', 'trivia', 'tacos', 'coffee', 'free', 'halloween', 'brunch'];
const STORY_KIND: Record<string, string> = { daily: 'Daily', deep: 'Deep dive', weekend: 'Weekend guide', guide: 'Guide' };

/** Search the whole app as you type. */
export default function Search() {
  const theme = useTheme();
  const track = useTrack();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>();
  const [error, setError] = useState<string>();

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      searchAll(text).then(
        (r) => {
          if (!live) return;
          setHits(r);
          setError(undefined);
          track('search_used', { query: text.toLowerCase().slice(0, 60), results: r.length });
        },
        (e: Error) => live && setError(e.message),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, track]);

  const groups = useMemo(() => {
    if (q.trim().length < 2 || !hits) return [];
    return ORDER.map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind) })).filter((g) => g.items.length);
  }, [hits, q]);

  const open = (h: SearchHit) => {
    track('search_opened', { kind: h.kind });
    if (h.kind === 'event') return router.push({ pathname: '/event/[id]', params: { id: h.id } });
    if (h.kind === 'weekly') return router.push({ pathname: '/events', params: { view: 'weekly' } });
    if (h.kind === 'place') return h.url ? openLink(h.url) : openDirections({ title: h.title, venue: h.title, address: h.detail || null });
    if (h.url) openLink(h.url);
  };

  const detailFor = (h: SearchHit) => {
    if (h.kind === 'event' && h.starts_at) return `${shortDay(h.starts_at)} · ${timeLabel(h.starts_at)}${h.detail ? ` · ${h.detail}` : ''}`;
    if (h.kind === 'story') return `${STORY_KIND[h.detail] ?? 'Story'}${h.starts_at ? ` · ${shortDay(h.starts_at)}` : ''}`;
    return h.detail;
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            Close
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <Field
            label="Search Wichita Life"
            value={q}
            onChangeText={setQ}
            placeholder="Events, restaurants, trivia, stories…"
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />

          {q.trim().length < 2 ? (
            <View style={{ gap: Spacing.two }}>
              <T variant="small">Try</T>
              <ChipRow>
                {IDEAS.map((idea) => (
                  <Chip key={idea} label={idea} onPress={() => setQ(idea)} />
                ))}
              </ChipRow>
            </View>
          ) : null}

          {error ? <T color={Brand.redText}>{error}</T> : null}

          {q.trim().length >= 2 && hits && !groups.length ? (
            <Card>
              <T>Nothing for “{q.trim()}” yet. Try fewer or different words.</T>
            </Card>
          ) : null}

          {groups.map((g) => (
            <View key={g.kind} style={{ gap: Spacing.two }}>
              <T variant="cardTitle" style={{ fontSize: 16 }}>
                {KIND_HEADINGS[g.kind]}
              </T>
              {g.items.map((h) => (
                <PressableCard key={`${h.kind}-${h.id}`} accessibilityRole="button" onPress={() => open(h)}>
                  <T variant="cardTitle" numberOfLines={2}>
                    {h.title}
                  </T>
                  {detailFor(h) ? (
                    <T variant="small" numberOfLines={1}>
                      {detailFor(h)}
                    </T>
                  ) : null}
                </PressableCard>
              ))}
            </View>
          ))}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
