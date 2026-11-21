import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** Sections someone folded away on a screen (tap a section's title), remembered on this device. */
export function useFolds(screen: string) {
  const key = `wl.folds.${screen}`;
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    AsyncStorage.getItem(key).then(
      (saved) => {
        try {
          if (saved) setFolded(new Set(JSON.parse(saved) as string[]));
        } catch {
          // A garbled saved value just means nothing is folded.
        }
      },
      () => {},
    );
  }, [key]);
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = new Set(f);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(key, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  return { isOpen: (id: string) => !folded.has(id), toggle };
}
