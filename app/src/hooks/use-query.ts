import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/lib/format';

type QueryState<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refreshing: boolean;
  /** When the shown data was loaded, if it came from the saved copy and the latest load failed (offline). */
  staleSince: number | undefined;
};

type Saved<T> = { at: number; data: T };

/**
 * Small loader for screen data: initial load plus pull-to-refresh. With `cacheKey`, the last
 * successful load is saved on the device and shown immediately on the next launch (or with no
 * signal) while the fresh copy loads.
 */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[] = [], opts: { cacheKey?: string } = {}) {
  const { cacheKey } = opts;
  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    error: undefined,
    loading: true,
    refreshing: false,
    staleSince: undefined,
  });
  const savedAt = useRef<number>(undefined);
  const [version, setVersion] = useState(0);

  // Show the saved copy while the first load runs.
  useEffect(() => {
    if (!cacheKey) return;
    let active = true;
    AsyncStorage.getItem(`query:${cacheKey}`)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw) as Saved<T>;
        savedAt.current = saved.at;
        // If the first load already failed (no signal), show the saved copy instead of the error.
        setState((s) =>
          s.data === undefined
            ? { ...s, data: saved.data, loading: false, error: undefined, staleSince: s.error ? saved.at : undefined }
            : s,
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (!active) return;
        setState({ data, error: undefined, loading: false, refreshing: false, staleSince: undefined });
        if (cacheKey) {
          const at = Date.now();
          savedAt.current = at;
          AsyncStorage.setItem(`query:${cacheKey}`, JSON.stringify({ at, data } satisfies Saved<T>)).catch(() => {});
        }
      },
      (e: unknown) =>
        active &&
        setState((s) => ({
          ...s,
          // With a saved copy on screen, a failed load just means we're showing older data.
          error: s.data !== undefined && cacheKey ? undefined : e instanceof Error ? e : new Error(errorMessage(e)),
          staleSince: s.data !== undefined && cacheKey ? (savedAt.current ?? Date.now()) : undefined,
          loading: false,
          refreshing: false,
        })),
    );
    return () => {
      active = false;
    };
    // `load` is usually an inline function; callers list what it depends on in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, refreshing: true }));
    setVersion((v) => v + 1);
  }, []);

  return { ...state, refresh };
}
