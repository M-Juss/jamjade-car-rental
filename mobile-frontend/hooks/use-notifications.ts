import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { getUnreadNotificationRevision, setUnreadNotificationCount, useUnreadNotificationCount } from '@/lib/customer/notification-unread';
import { useAuth } from '@/providers/AuthProvider';
import {
  getNotificationPage,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type MobileNotificationRecord,
} from '@/services/api';

export function useNotifications() {
  const { user } = useAuth();
  const unreadCount = useUnreadNotificationCount();
  const [notifications, setNotifications] = useState<MobileNotificationRecord[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<MobileNotificationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cursor = useRef<string | null>(null);
  const loading = useRef(false);
  const loadingMore = useRef(false);
  const markingAllRead = useRef(false);
  const opening = useRef(false);
  const expanded = useRef(false);
  const moreError = useRef(false);
  const readIds = useRef(new Set<string>());
  const latestLoad = useRef(0);
  const latestOpen = useRef(0);
  const focused = useRef(false);
  const lifecycle = useRef(0);

  const loadNotifications = useCallback(async () => {
    if (markingAllRead.current || opening.current) return;
    const loadId = ++latestLoad.current;
    const revision = getUnreadNotificationRevision();
    loading.current = true;
    loadingMore.current = false;
    expanded.current = false;
    moreError.current = false;
    cursor.current = null;
    setIsExpanded(false);
    setIsLoadingMore(false);
    setLoadMoreError(null);
    setHasMore(false);
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);

    try {
      const page = await getNotificationPage();
      if (loadId !== latestLoad.current) return;
      setNotifications(page.notifications.map((item) => readIds.current.has(item.id) ? { ...item, isRead: true } : item));
      cursor.current = page.nextCursor;
      setHasMore(page.hasMore);
      if (revision === getUnreadNotificationRevision()) setUnreadNotificationCount(page.unreadCount);
    } catch {
      if (loadId === latestLoad.current) setLoadError('Notifications could not be loaded. Please try again.');
    } finally {
      if (loadId === latestLoad.current) {
        loading.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    lifecycle.current += 1;
    opening.current = false;
    markingAllRead.current = false;
    setIsMarkingAllRead(false);
    readIds.current.clear();
    setNotifications([]);
    setSelectedNotification(null);
    void loadNotifications();
    return () => {
      focused.current = false;
      lifecycle.current += 1;
      latestLoad.current += 1;
      latestOpen.current += 1;
      loading.current = false;
      loadingMore.current = false;
    };
  }, [loadNotifications, user?.id]));

  const loadOlderNotifications = async (manual = false) => {
    if (!focused.current || loading.current || loadingMore.current || markingAllRead.current || !cursor.current || (!manual && (!expanded.current || moreError.current))) return;
    const loadId = latestLoad.current;
    const nextCursor = cursor.current;
    loadingMore.current = true;
    moreError.current = false;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await getNotificationPage({ cursor: nextCursor, perPage: 5 });
      if (loadId !== latestLoad.current) return;
      setNotifications((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...page.notifications.filter((item) => !ids.has(item.id)).map((item) => readIds.current.has(item.id) ? { ...item, isRead: true } : item)];
      });
      cursor.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch {
      if (loadId === latestLoad.current) {
        moreError.current = true;
        setLoadMoreError('Older notifications could not be loaded.');
      }
    } finally {
      if (loadId === latestLoad.current) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  };

  const viewAllNotifications = () => {
    expanded.current = true;
    setIsExpanded(true);
    void loadOlderNotifications(true);
  };

  const closeNotification = useCallback(() => {
    latestOpen.current += 1;
    setSelectedNotification(null);
  }, []);

  const openNotification = async (notification: MobileNotificationRecord) => {
    if (opening.current || markingAllRead.current || loading.current) return;
    const openId = ++latestOpen.current;
    const generation = latestLoad.current;
    const session = lifecycle.current;
    opening.current = true;
    setActionError(null);
    try {
      let updated = notification;
      if (!notification.isRead) {
        const result = await markNotificationAsRead(notification.id);
        if (!focused.current || generation !== latestLoad.current) return;
        updated = result.notification;
        readIds.current.add(updated.id);
        setUnreadNotificationCount(result.unreadCount);
        setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
      }
      if (openId === latestOpen.current && focused.current) setSelectedNotification(updated);
    } catch {
      if (openId === latestOpen.current && focused.current) setActionError('This notification could not be opened. Please try again.');
    } finally {
      if (session === lifecycle.current) opening.current = false;
    }
  };

  const markAllRead = async () => {
    if (markingAllRead.current || opening.current || loading.current) return;
    const generation = latestLoad.current;
    const session = lifecycle.current;
    markingAllRead.current = true;
    setIsMarkingAllRead(true);
    setActionError(null);
    try {
      const count = await markAllNotificationsAsRead();
      if (!focused.current || generation !== latestLoad.current) return;
      // Discard an older page fetched before the read-all mutation; retry it with the same cursor.
      latestLoad.current += 1;
      loadingMore.current = false;
      setIsLoadingMore(false);
      setUnreadNotificationCount(count);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setSelectedNotification((current) => current ? { ...current, isRead: true } : current);
    } catch {
      if (focused.current && generation === latestLoad.current) setActionError('Notifications could not be marked as read. Please try again.');
    } finally {
      if (session === lifecycle.current) {
        markingAllRead.current = false;
        setIsMarkingAllRead(false);
      }
    }
  };

  return {
    notifications, unreadCount, selectedNotification, isLoading, loadError, actionError,
    isMarkingAllRead, isLoadingMore, loadMoreError, hasMore, isExpanded,
    loadNotifications, openNotification, closeNotification, markAllRead,
    viewAllNotifications, loadOlderNotifications,
    reportActionError: setActionError,
  };
}
