import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getTelematicsRentals, type MobileTelematicsRental } from '@/services/api';

export function useTelematicsRentals() {
  const [rentals, setRentals] = useState<MobileTelematicsRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [verified, setVerified] = useState(false);
  const page = useRef(1);
  const generation = useRef(0);
  const reading = useRef(false);
  const focused = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    if (!focused.current || reading.current || AppState.currentState !== 'active') return;
    const request = ++generation.current;
    reading.current = true;
    if (!silent) { setRefreshing(true); setVerified(false); }
    try {
      const first = await getTelematicsRentals();
      const lastLoaded = Math.min(page.current, first.lastPage);
      const updated = [...first.rentals];
      for (let next = 2; next <= lastLoaded; next++) {
        if (request !== generation.current) return;
        updated.push(...(await getTelematicsRentals(next)).rentals);
      }
      if (request !== generation.current || !focused.current) return;
      setRentals([...new Map(updated.map((rental) => [rental.bookingCode, rental])).values()]);
      page.current = lastLoaded;
      setHasMore(lastLoaded < first.lastPage);
      setVerified(true);
      setError(null);
      setPageError(null);
    } catch {
      if (request === generation.current) {
        setError('Rentals could not be refreshed. Check your connection and try again.');
        setVerified(false);
      }
    } finally {
      if (request === generation.current) {
        reading.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setVerified(false);
    void refresh();
    const interval = setInterval(() => void refresh(true), 15000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(true);
      else {
        generation.current++;
        reading.current = false;
        setVerified(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    });
    return () => {
      focused.current = false;
      generation.current++;
      reading.current = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]));

  const loadMore = async () => {
    if (!focused.current || reading.current || !hasMore || !verified || AppState.currentState !== 'active') return;
    const request = ++generation.current;
    reading.current = true;
    setLoadingMore(true);
    setPageError(null);
    try {
      const result = await getTelematicsRentals(page.current + 1);
      if (request !== generation.current || !focused.current) return;
      setRentals((current) => [...new Map([...current, ...result.rentals].map((rental) => [rental.bookingCode, rental])).values()]);
      page.current++;
      setHasMore(page.current < result.lastPage);
    } catch {
      if (request === generation.current) setPageError('More rentals could not be loaded. Try again.');
    } finally {
      if (request === generation.current) {
        reading.current = false;
        setLoadingMore(false);
      }
    }
  };

  return { rentals, loading, refreshing, loadingMore, error, pageError, hasMore, verified, refresh, loadMore };
}
