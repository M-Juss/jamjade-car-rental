import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { prepareRentalBackgroundAccess, readRentalBackgroundAccess, type BackgroundAccess } from '@/services/telematics/background-location-access';

export function useBackgroundLocationAccess(ensureAvailable: () => Promise<boolean>) {
  const [access, setAccess] = useState<BackgroundAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const generation = useRef(0);
  const revision = useRef(0);
  const working = useRef(false);
  const eligible = useRef(ensureAvailable);
  eligible.current = ensureAvailable;

  useFocusEffect(useCallback(() => {
    const current = ++generation.current;
    working.current = false;
    setBusy(false);
    async function read() {
      if (working.current || AppState.currentState !== 'active') return;
      const attempt = ++revision.current;
      try {
        const value = await readRentalBackgroundAccess();
        if (generation.current === current && revision.current === attempt && !working.current) { setAccess(value); setError(null); }
      } catch {
        if (generation.current === current && revision.current === attempt && !working.current) setError('Background access could not be checked. Try again.');
      }
    }
    void read();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void read(); });
    return () => { generation.current++; subscription.remove(); };
  }, []));

  const prepare = useCallback(async () => {
    if (working.current || AppState.currentState !== 'active') return;
    const current = generation.current;
    revision.current++;
    working.current = true;
    setBusy(true);
    setError(null);
    const isCurrent = () => generation.current === current && AppState.currentState === 'active';
    try {
      if (!await eligible.current()) {
        if (isCurrent()) setError('Background access is unavailable for this rental.');
        return;
      }
      if (!isCurrent()) return;
      setAttempted(true);
      const value = await prepareRentalBackgroundAccess(isCurrent);
      if (value && isCurrent()) setAccess(value);
    } catch {
      if (isCurrent()) setError('Background access could not be prepared. Try again.');
    } finally {
      if (generation.current === current) { working.current = false; setBusy(false); }
    }
  }, []);

  return { access, busy, error, attempted, prepare };
}
