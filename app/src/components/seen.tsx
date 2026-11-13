import { useIsFocused } from 'expo-router';
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { Dimensions, Platform, View, type ViewStyle } from 'react-native';

import { useTrack, type EventPlace } from '@/lib/analytics';

/**
 * Event impressions for PostHog: an event counts as seen the first time at least half of its card is
 * on screen, once per event and place (Today, Events, Saved…) per app visit. Taps are counted
 * separately as event_clicked.
 */
const seen = new Set<string>();
const listeners = new Set<() => void>();

/** Scrollers call this as they move so cards can check whether they're on screen. */
export const scrollTick = () => listeners.forEach((check) => check());

// On the web the page can scroll in a container outside our ScrollViews, so listen to every scroll
// on the page (throttled, with a last check when scrolling stops).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  let last = 0;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener(
    'scroll',
    () => {
      clearTimeout(trailing);
      trailing = setTimeout(scrollTick, 200);
      if (Date.now() - last > 250) {
        last = Date.now();
        scrollTick();
      }
    },
    { capture: true, passive: true },
  );
}

export function Seen({ event, from, children, style }: { event: { id: string; title: string }; from: EventPlace; children: ReactNode; style?: ViewStyle }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const track = useTrack();
  const focused = useIsFocused();

  useEffect(() => {
    const key = `${from}:${event.id}`;
    if (!focused || seen.has(key)) return;
    let done = false;
    const check = () => {
      ref.current?.measureInWindow((x, y, w, h) => {
        if (done || !w || !h || seen.has(key)) return;
        const win = Dimensions.get('window');
        const shownH = Math.min(y + h, win.height) - Math.max(y, 0);
        const shownW = Math.min(x + w, win.width) - Math.max(x, 0);
        if (shownH >= h / 2 && shownW >= w / 2) {
          done = true;
          seen.add(key);
          listeners.delete(check);
          track('event_impression', { event_id: event.id, title: event.title, from });
        }
      });
    };
    listeners.add(check);
    // Once laid out (and again after opening a folded day or "Show more").
    const first = setTimeout(check, 400);
    return () => {
      done = true;
      clearTimeout(first);
      listeners.delete(check);
    };
  }, [focused, event.id, event.title, from, track]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
