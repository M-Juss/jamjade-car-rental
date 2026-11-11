import { apiGet } from '@/services/http';

type ActivityEntry = {
  id: string;
  occurredAt: string;
};

export type RentalActivityNotice = ActivityEntry & {
  kind: 'notification';
  title: string;
  message: string;
  isRead: boolean;
};

export type RentalManeuver = ActivityEntry & {
  kind: 'maneuver';
  target: 'harsh_acceleration' | 'harsh_braking' | 'harsh_cornering' | 'harsh_swerve';
  status: 'confirmed' | 'review_required';
};

export type RentalActivityEntry = RentalActivityNotice | RentalManeuver;

export async function getRentalActivity(bookingCode: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await apiGet<RentalActivityEntry[]>(`/mobile/bookings/${encodeURIComponent(bookingCode)}/activity${query}`);
  return {
    entries: response.data,
    nextCursor: typeof response.meta?.next_cursor === 'string' ? response.meta.next_cursor : null,
    hasMore: response.meta?.has_more === true,
    unreadCount: Number(response.meta?.unread_count ?? 0),
    bookingUnreadCount: Number(response.meta?.booking_unread_count ?? 0),
  };
}
