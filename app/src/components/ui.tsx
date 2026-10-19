import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NotConfiguredError } from '@/lib/api';

type TextVariant = 'body' | 'small' | 'label' | 'title' | 'heading' | 'script' | 'cardTitle';

export function T({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string }) {
  const theme = useTheme();
  const styles: Record<TextVariant, TextStyle> = {
    body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: theme.text },
    small: { fontFamily: Fonts.bodySemi, fontSize: 12.5, lineHeight: 17, color: theme.textSecondary },
    label: {
      fontFamily: Fonts.display,
      fontSize: 10.5,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    title: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 23, color: theme.heading },
    heading: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 27, color: theme.heading },
    cardTitle: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: theme.heading },
    script: { fontFamily: Fonts.script, fontSize: 34, lineHeight: 38, color: theme.script },
  };
  return <Text {...rest} style={[styles[variant], color ? { color } : null, style]} />;
}

/** Scrollable screen body with a content width cap and pull-to-refresh. */
export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.script} /> : undefined
      }>
      <View style={styles.screenInner}>{children}</View>
    </ScrollView>
  );
}

/** Orange brand bar with the WL logo, used at the top of each tab. */
export function AppHeader({ title, right }: { title: string; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.header, borderBottomWidth: 2, borderColor: Brand.navy }}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} contentFit="contain" />
          <View>
            <T variant="script" style={{ fontSize: 18, lineHeight: 20 }}>
              Wichita Life
            </T>
            <T variant="title" color={theme.headerText} style={{ fontSize: 20 }}>
              {title}
            </T>
          </View>
        </View>
        {right}
      </View>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }, style]}>{children}</View>
  );
}

/** The logo's signature look: thick navy outline with a solid offset shadow. */
export function Sticker({
  children,
  color,
  shadow,
  style,
}: {
  children: ReactNode;
  color: string;
  shadow: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stickerWrap, style]}>
      <View style={[styles.stickerShadow, { backgroundColor: shadow }]} />
      <View style={[styles.sticker, { backgroundColor: color }]}>{children}</View>
    </View>
  );
}

export function PressableCard({ children, style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.line, opacity: pressed ? 0.85 : 1 },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  tone = 'navy',
  disabled,
  small,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'navy' | 'red' | 'orange' | 'ghost' | 'done';
  disabled?: boolean;
  small?: boolean;
}) {
  const theme = useTheme();
  const bg = { navy: Brand.navy, red: Brand.red, orange: Brand.orange, ghost: theme.card, done: Brand.green }[tone];
  const fg = tone === 'orange' ? Brand.navy : tone === 'ghost' ? theme.heading : Brand.white;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        {
          backgroundColor: bg,
          borderColor: Brand.navy,
          transform: pressed ? [{ translateX: 2 }, { translateY: 2 }] : [],
          shadowColor: Brand.blue,
        },
        disabled && { opacity: 0.6 },
      ]}>
      <Text style={[styles.buttonText, small && { fontSize: 12.5 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.outline, backgroundColor: active ? Brand.blue : theme.card },
      ]}>
      <Text style={[styles.chipText, { color: active ? Brand.white : theme.heading }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  );
}

export function Tag({ label, tone = 'orange' }: { label: string; tone?: 'orange' | 'green' | 'blue' }) {
  const theme = useTheme();
  const bg = { orange: theme.orangeSoft, green: theme.greenSoft, blue: theme.blueSoft }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="title">{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Loading, empty and error states, including the "Supabase isn't connected" setup hint. */
export function LoadState({ loading, error, empty }: { loading: boolean; error?: Error; empty?: string }) {
  if (loading) return <ActivityIndicator style={{ marginVertical: Spacing.four }} color={Brand.blue} />;
  if (error instanceof NotConfiguredError) {
    return (
      <Card style={{ gap: Spacing.one }}>
        <T variant="cardTitle">Connect Supabase to load content</T>
        <T variant="small">
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to app/.env, then restart the dev server.
        </T>
      </Card>
    );
  }
  if (error) {
    return (
      <Card style={{ gap: Spacing.one }}>
        <T variant="cardTitle">Couldn&apos;t load this right now</T>
        <T variant="small">Pull down to try again. ({error.message})</T>
      </Card>
    );
  }
  if (empty) return <T variant="small" style={{ textAlign: 'center', marginVertical: Spacing.three }}>{empty}</T>;
  return null;
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  screenInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  card: { borderWidth: 1.5, borderRadius: Radius.card, padding: Spacing.three - 2, gap: Spacing.one },
  stickerWrap: { marginRight: 6, marginBottom: 6 },
  stickerShadow: { position: 'absolute', top: 6, left: 6, right: -6, bottom: -6, borderRadius: Radius.sticker },
  sticker: {
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: Radius.sticker,
    padding: Spacing.three + 2,
    gap: Spacing.two,
  },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: Radius.button,
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  buttonSmall: { paddingHorizontal: 13, paddingVertical: 6 },
  buttonText: { fontFamily: Fonts.display, fontSize: 14 },
  chip: { borderWidth: 2, borderRadius: Radius.pill, paddingHorizontal: 13, paddingVertical: 5 },
  chipText: { fontFamily: Fonts.displaySemi, fontSize: 13 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  tagText: { fontFamily: Fonts.display, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
