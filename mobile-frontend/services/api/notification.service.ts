import { apiGet, apiPost } from '@/services/http';

import type { MobileNotificationRecord } from './types';

function normalizeNotification(notification: MobileNotificationRecord) {
  return {
    ...notification,
    bookingId: notification.bookingId ?? undefined,
    vehicleName: notification.vehicleName ?? undefined,
    paymentStatus: notification.paymentStatus ?? undefined,
    tripStatus: notification.tripStatus ?? undefined,
    actionLabel: notification.actionLabel ?? undefined,
  };
}

export type NotificationPage = {
  notifications: MobileNotificationRecord[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
  bookingUnreadCount: number | null;
};

export async function getNotificationPage({ cursor, perPage = 10, bookingCode }: { cursor?: string; perPage?: 5 | 10; bookingCode?: string } = {}): Promise<NotificationPage> {
  const params = new URLSearchParams({ pagination: 'cursor', per_page: String(perPage) });
  if (cursor) params.set('cursor', cursor);
  if (bookingCode) params.set('booking_code', bookingCode);
  const response = await apiGet<MobileNotificationRecord[]>(`/mobile/notifications?${params}`);
  return {
    notifications: response.data.map(normalizeNotification),
    nextCursor: typeof response.meta?.next_cursor === 'string' ? response.meta.next_cursor : null,
    hasMore: response.meta?.has_more === true,
    unreadCount: Number(response.meta?.unread_count ?? 0),
    bookingUnreadCount: typeof response.meta?.booking_unread_count === 'number' ? response.meta.booking_unread_count : null,
  };
}

export async function getUnreadNotificationCount() {
  const response = await apiGet<{ unreadCount: number }>('/mobile/notifications/unread-count');
  return response.data.unreadCount;
}

export async function markNotificationAsRead(notificationId: string) {
  const response = await apiPost<MobileNotificationRecord>(
    `/mobile/notifications/${encodeURIComponent(notificationId)}/read`,
  );
  return { notification: normalizeNotification(response.data), unreadCount: Number(response.meta?.unread_count ?? 0) };
}

export async function markAllNotificationsAsRead(bookingCode?: string) {
  const response = await apiPost<{ updated: number }>('/mobile/notifications/read-all', bookingCode ? { booking_code: bookingCode } : undefined);
  return Number(response.meta?.unread_count ?? 0);
}
