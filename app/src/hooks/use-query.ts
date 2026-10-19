import { useCallback, useEffect, useState } from 'react';

type QueryState<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refreshing: boolean;
};

/** Small loader for screen data: initial load plus pull-to-refresh. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    error: undefined,
    loading: true,
    refreshing: false,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ data, error: undefined, loading: false, refreshing: false }),
      (e: unknown) =>
        active &&
        setState((s) => ({
          ...s,
          error: e instanceof Error ? e : new Error(String(e)),
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
