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

export async function getNotifications() {
  const notifications: MobileNotificationRecord[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await apiGet<MobileNotificationRecord[]>(
      `/mobile/notifications?per_page=100&page=${page}`,
    );

    notifications.push(...response.data);
    lastPage = Number(response.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

  return notifications.map(normalizeNotification);
}

export async function markNotificationAsRead(notificationId: string) {
  const response = await apiPost<MobileNotificationRecord>(
    `/mobile/notifications/${encodeURIComponent(notificationId)}/read`,
  );

  return normalizeNotification(response.data);
}

export async function markAllNotificationsAsRead() {
  await apiPost<{ updated: number }>('/mobile/notifications/read-all');
}
