import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getUnreadNotificationRevision, setUnreadNotificationCount } from '@/lib/customer/notification-unread';
import { useAuth } from '@/providers/AuthProvider';
import { markAllNotificationsAsRead, markNotificationAsRead } from '@/services/api';
import { getRentalActivity, type RentalActivityEntry, type RentalActivityNotice } from '@/services/api/rental-activity.service';

const entryKey = (entry: RentalActivityEntry) => `${entry.kind}:${entry.id}`;

function applyLocalRead(entry: RentalActivityEntry, readIds: Set<string>): RentalActivityEntry {
  return entry.kind === 'notification' && readIds.has(entry.id) ? { ...entry, isRead: true } : entry;
}

export function useTelematicsActivity(bookingCode: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<RentalActivityEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const firstPageKey = useRef<string | null>(null);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);
  const reading = useRef(false);
  const writing = useRef(false);
  const focused = useRef(false);
  const readIds = useRef(new Set<string>());
  const marking = useRef(false);

  const refresh = useCallback(async (quiet = false) => {
    if (!focused.current || reading.current || writing.current || AppState.currentState !== 'active') return;
    const request = ++generation.current;
    const revision = getUnreadNotificationRevision();
    reading.current = true;
    if (!quiet) setLoading(true);
    try {
      const page = await getRentalActivity(bookingCode);
      if (!focused.current || request !== generation.current) return;
      const pageKey = `${page.hasMore}:${page.entries.map(entryKey).join(',')}`;
      if (!quiet || pageKey !== firstPageKey.current) {
        setItems(page.entries.map((item) => applyLocalRead(item, readIds.current)));
        firstPageKey.current = pageKey;
        cursor.current = page.nextCursor;
        setHasMore(page.hasMore);
      }
      setUnread(page.bookingUnreadCount ?? 0);
      if (revision === getUnreadNotificationRevision()) setUnreadNotificationCount(page.unreadCount);
      setError(null);
    } catch {
      if (request === generation.current) setError('Activity could not be loaded. Try again.');
    } finally {
      if (request === generation.current) { reading.current = false; setLoading(false); }
    }
  }, [bookingCode]);

  useFocusEffect(useCallback(() => {
    if (!user?.id || !bookingCode) return;
    focused.current = true;
    reading.current = false;
    writing.current = false;
    marking.current = false;
    readIds.current.clear();
    firstPageKey.current = null;
    cursor.current = null;
    setHasMore(false);
    setItems([]);
    setUnread(0);
    setLoadingMore(false);
    setOpeningId(null);
    setMarkingAllRead(false);
    void refresh();
    const interval = setInterval(() => { void refresh(true); }, 15000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(true); });
    return () => { focused.current = false; generation.current++; clearInterval(interval); subscription.remove(); };
  }, [bookingCode, refresh, user?.id]));

  const loadMore = async () => {
    if (!focused.current || reading.current || writing.current || !cursor.current) return;
    const request = generation.current;
    reading.current = true;
    setLoadingMore(true);
    try {
      const page = await getRentalActivity(bookingCode, cursor.current);
      if (!focused.current || request !== generation.current) return;
      setItems((current) => {
        const ids = new Set(current.map(entryKey));
        const older = page.entries.filter((item) => !ids.has(entryKey(item)));
        return [...current, ...older.map((item) => applyLocalRead(item, readIds.current))];
      });
      cursor.current = page.nextCursor;
      setHasMore(page.hasMore);
      setError(null);
    } catch {
      if (request === generation.current) setError('Older activity could not be loaded. Try again.');
    } finally {
      if (request === generation.current) { reading.current = false; setLoadingMore(false); }
    }
  };

  const markRead = async (item: RentalActivityNotice) => {
    if (item.isRead) return;
    if (writing.current || !focused.current) return;
    writing.current = true;
    const request = ++generation.current;
    reading.current = false;
    setLoading(false);
    setLoadingMore(false);
    setOpeningId(item.id);
    try {
      const result = await markNotificationAsRead(item.id);
      if (!focused.current || request !== generation.current) return;
      if (result) {
        readIds.current.add(item.id);
        setUnreadNotificationCount(result.unreadCount);
        setUnread((count) => Math.max(0, count - 1));
        setItems((current) => current.map((entry) => entry.kind === 'notification' && entry.id === item.id ? { ...entry, isRead: true } : entry));
      }
      setError(null);
    } catch {
      if (request === generation.current) setError('This activity could not be marked as read. Try again.');
    } finally {
      if (request === generation.current) { writing.current = false; setOpeningId(null); }
    }
  };

  const markAllRead = async () => {
    if (unread === 0 || marking.current || writing.current || !focused.current) return;
    marking.current = true;
    writing.current = true;
    const request = ++generation.current;
    reading.current = false;
    setLoading(false);
    setLoadingMore(false);
    setMarkingAllRead(true);
    try {
      const accountUnreadCount = await markAllNotificationsAsRead(bookingCode);
      if (!focused.current || request !== generation.current) return;
      setUnreadNotificationCount(accountUnreadCount);
      setUnread(0);
      setItems((current) => current.map((item) => {
        if (item.kind === 'maneuver') return item;
        if (!item.isRead) readIds.current.add(item.id);
        return { ...item, isRead: true };
      }));
      setError(null);
    } catch {
      if (focused.current && request === generation.current) setError('Activity could not be marked as read. Try again.');
    } finally {
      if (request === generation.current) {
        marking.current = false;
        writing.current = false;
        setMarkingAllRead(false);
      }
    }
  };

  return { items, unread, loading, loadingMore, error, hasMore, openingId, markingAllRead, refresh, loadMore, markRead, markAllRead };
}
