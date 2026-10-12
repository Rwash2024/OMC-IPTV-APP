import { useCallback, useEffect, useState } from 'react';

const cache = new Map();
export const clearCache = () => cache.clear();

// Loads once per key and keeps the result for the rest of the session.
export function useLoad(key, loader) {
  const [state, setState] = useState(() => (cache.has(key) ? { loading: false, data: cache.get(key), error: null } : { loading: true, data: null, error: null }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (cache.has(key)) { setState({ loading: false, data: cache.get(key), error: null }); return; }
    let alive = true;
    setState({ loading: true, data: null, error: null });
    loader()
      .then((d) => { const v = Array.isArray(d) ? d : d ?? []; cache.set(key, v); if (alive) setState({ loading: false, data: v, error: null }); })
      .catch((e) => { if (alive) setState({ loading: false, data: null, error: e }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}
