import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NotConfiguredError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeTime } from '@/lib/format';

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
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      // Room at the bottom so the last lines clear the floating iPhone tab bar and home indicator.
      contentContainerStyle={[styles.screenContent, { paddingBottom: Spacing.six + insets.bottom + (Platform.OS === 'ios' ? 56 : 0) }]}
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
  const { session, profile } = useAuth();
  const initial = (profile?.display_name || session?.user.email || '?').trim().charAt(0).toUpperCase();
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
        <View style={styles.headerRight}>
          {right}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            hitSlop={8}
            onPress={() => router.push('/search')}
            style={[styles.avatar, { width: 36, paddingHorizontal: 0, backgroundColor: theme.card, borderColor: Brand.navy }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.heading} strokeWidth={2.6} strokeLinecap="round">
              <Circle cx={10.5} cy={10.5} r={6.5} />
              <Path d="M15.5 15.5 21 21" />
            </Svg>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={session ? 'Your account' : 'Sign in'}
            hitSlop={8}
            onPress={() => router.push(session ? '/account' : '/sign-in')}
            style={[styles.avatar, { backgroundColor: session ? Brand.blue : theme.card, borderColor: Brand.navy }]}>
            {session ? (
              <Text style={[styles.avatarText, { color: Brand.white }]}>{initial}</Text>
            ) : (
              <Text style={[styles.signInText, { color: theme.heading }]}>Sign in</Text>
            )}
          </Pressable>
        </View>
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

export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        {...rest}
        style={[styles.field, { borderColor: theme.outline, backgroundColor: theme.card, color: theme.text }, style]}
      />
    </View>
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
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${action} ${title}`}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Loading, empty and error states, including the "Supabase isn't connected" setup hint. With
 * `staleSince`, notes that the screen is showing a saved copy because the latest load failed.
 */
export function LoadState({
  loading,
  error,
  empty,
  staleSince,
}: {
  loading: boolean;
  error?: Error;
  empty?: string;
  staleSince?: number;
}) {
  if (loading) return <ActivityIndicator style={{ marginVertical: Spacing.four }} color={Brand.blue} />;
  if (staleSince) {
    return (
      <T variant="small" style={{ textAlign: 'center' }}>
        Offline · showing what loaded {relativeTime(new Date(staleSince).toISOString())} ago. Pull down to refresh.
      </T>
    );
  }
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
  // On a wide screen the header's contents line up with the content column below it.
  header: {
    width: '100%',
    maxWidth: MaxContentWidth + 2 * Spacing.three,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatar: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  avatarText: { fontFamily: Fonts.display, fontSize: 15 },
  signInText: { fontFamily: Fonts.display, fontSize: 12.5 },
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
  field: { borderWidth: 2, borderRadius: Radius.button, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.body, fontSize: 16 },
  chip: { borderWidth: 2, borderRadius: Radius.pill, paddingHorizontal: 13, paddingVertical: 5 },
  chipText: { fontFamily: Fonts.displaySemi, fontSize: 13 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  tagText: { fontFamily: Fonts.display, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});

/**
 * Top bar of a screen that opens over the app (event, account, sign-in…): a roomy Close pill
 * at the right, clear of the sheet's top edge, with a big tap area.
 */
export function ModalClose({ label = 'Close', onPress }: { label?: string; onPress?: () => void }) {
  return (
    <View style={extraStyles.modalBar}>
      <ClosePill label={label} onPress={onPress} />
    </View>
  );
}

/** Top bar of a pushed screen (My plans, Friends, a plan, a group…): a roomy "‹ Back" pill at the left. */
export function BackBar({ label = 'Back', onPress }: { label?: string; onPress?: () => void }) {
  return (
    <View style={[extraStyles.modalBar, { alignItems: 'flex-start' }]}>
      <ClosePill label={`‹ ${label}`} onPress={onPress} />
    </View>
  );
}

/** The Close pill itself, for screens that put it beside a title (games). Also the Back pill. */
export function ClosePill({ label = 'Close', onPress }: { label?: string; onPress?: () => void }) {
  const theme = useTheme();
  const close = onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={close}
      hitSlop={10}
      style={({ pressed }) => [extraStyles.modalClose, { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[extraStyles.modalCloseText, { color: Brand.redText }]}>{label}</Text>
    </Pressable>
  );
}

export type MoreAction = { label: string; onPress: () => void; destructive?: boolean };

/**
 * A "•••" button for the less-used actions on a screen. iPhone shows the native action sheet;
 * Android and the web open a small list right under the button.
 */
export function MoreButton({ actions, title }: { actions: MoreAction[]; title?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  const show = () => {
    if (Platform.OS === 'ios') {
      const destructive = actions.findIndex((a) => a.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...actions.map((a) => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
        },
        (i) => actions[i]?.onPress(),
      );
    } else setOpen((o) => !o);
  };
  return (
    <View>
      <Button small tone="ghost" label="•••" onPress={show} />
      {open ? (
        <View style={[extraStyles.moreList, { backgroundColor: theme.card, borderColor: theme.line }]}>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                a.onPress();
              }}
              style={[extraStyles.moreRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.line }]}>
              <Text style={[extraStyles.moreRowText, { color: a.destructive ? Brand.redText : theme.heading }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A grouped list of tappable rows (Account's My plans / Friends / Feedback), instead of a stack of buttons. */
export function MenuList({ rows }: { rows: { label: string; icon?: string; onPress: () => void; tone?: 'danger' }[] }) {
  const theme = useTheme();
  return (
    <View style={[extraStyles.menu, { backgroundColor: theme.card, borderColor: theme.line }]}>
      {rows.map((r, i) => (
        <Pressable
          key={r.label}
          accessibilityRole="button"
          onPress={r.onPress}
          style={({ pressed }) => [
            extraStyles.menuRow,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
            pressed && { opacity: 0.6 },
          ]}>
          {r.icon ? <Text style={extraStyles.menuIcon}>{r.icon}</Text> : null}
          <Text style={[extraStyles.menuText, { color: r.tone === 'danger' ? Brand.redText : theme.heading }]}>{r.label}</Text>
          {r.tone === 'danger' ? null : <Text style={[extraStyles.menuChevron, { color: theme.textSecondary }]}>›</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const extraStyles = StyleSheet.create({
  modalBar: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two, alignItems: 'flex-end' },
  modalClose: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 2, borderColor: Brand.navy },
  modalCloseText: { fontFamily: Fonts.display, fontSize: 14 },
  moreList: { marginTop: Spacing.two, borderWidth: 1, borderRadius: 12, overflow: 'hidden', minWidth: 220 },
  moreRow: { paddingVertical: 12, paddingHorizontal: Spacing.three },
  moreRowText: { fontFamily: Fonts.displaySemi, fontSize: 15 },
  menu: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 52, paddingHorizontal: Spacing.three },
  menuIcon: { fontSize: 18, width: 26 },
  menuText: { flex: 1, fontFamily: Fonts.displaySemi, fontSize: 16 },
  menuChevron: { fontSize: 22, fontFamily: Fonts.display },
});
