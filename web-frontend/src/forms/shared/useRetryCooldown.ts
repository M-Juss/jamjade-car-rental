"use client";

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/services/http/errors';

/** Absolute deadlines keep the countdown correct after backgrounding or suspended timers. */
export function useRetryCooldown(availableAt?: string) {
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const deadline = Math.max(retryAt, availableAt ? Date.parse(availableAt) || 0 : 0);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
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
