import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/services/http/errors';

/** Absolute deadlines keep the countdown correct after backgrounding or suspended timers. */
export function useRetryCooldown(availableAt?: string) {
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const deadline = Math.max(retryAt, availableAt ? Date.parse(availableAt) || 0 : 0);

  useEffect(() => {
    if (!deadline) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { clearInterval(timer); timer = undefined; };
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) stop();
    };
    const start = () => {
      if (!timer && Date.now() < deadline) timer = setInterval(tick, 1000);
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { tick(); start(); } else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setRetryAt(current + seconds * 1000);
  }, []);

  const handleError = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 429) return false;
    start(error.retryAfter ?? 60);
    return true;
  }, [start]);

  return { seconds: Math.max(0, Math.ceil((deadline - now) / 1000)), start, handleError };
}
