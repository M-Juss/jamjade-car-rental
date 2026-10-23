import { useRouter, type Href } from 'expo-router';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { NotificationDetailModal, NotificationFeed } from '@/components/notifications/NotificationFeed';
import { useNotifications } from '@/hooks/use-notifications';
import { canSelectTelematicsBooking } from '@/lib/telematics/setup';
import { useAuth } from '@/providers/AuthProvider';
import { getBooking, type MobileNotificationRecord } from '@/services/api';

type NotificationCategory = MobileNotificationRecord['category'];

const documentRouteByType: Record<string, string> = {
  drivers_license: 'driver-license',
  proof_of_billing: 'proof-of-address',
};

function getDocumentStatusLabel(status?: unknown) {
  if (status === 'approved') {
    return 'Approved';
  }

  if (status === 'rejected') {
    return 'Not accepted';
  }

  if (status === 'pending') {
    return 'Pending review';
  }

  return undefined;
}

function getDefaultActionLabel(category: NotificationCategory) {
  if (category === 'booking') {
    return 'View Booking';
  }

  if (category === 'payment') {
    return 'View Payment';
  }

  if (category === 'vehicle') {
    return 'View Vehicle';
  }

  if (category === 'trip') {
    return 'Open Telematics';
  }

  return 'View Details';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const {
    notifications,
    unreadCount,
    hasMore,
    isExpanded,
    isLoadingMore,
    loadMoreError,
    viewAllNotifications,
    loadOlderNotifications,
    selectedNotification,
    isLoading,
    loadError,
    actionError,
    isMarkingAllRead,
    loadNotifications,
    openNotification,
    closeNotification,
    markAllRead,
    reportActionError,
  } = useNotifications();

  const handleNotificationAction = async (notification: MobileNotificationRecord) => {
    closeNotification();

    if (notification.data?.action === 'view_telematics_activity' && notification.bookingId) {
      router.push(`/telematics/${encodeURIComponent(notification.bookingId)}?tab=activity` as Href);
      return;
    }

    if (notification.data?.action === 'view_delivery_quote' && typeof notification.data.vehicleId === 'string') {
      router.push(`/browse/booking?vehicleId=${encodeURIComponent(notification.data.vehicleId)}` as Href);
      return;
    }

    if (notification.data?.action === 'view_documents' || notification.data?.action === 'resubmit_document') {
      await refreshProfile().catch(() => undefined);

      const documentType =
        typeof notification.data.documentType === 'string' ? notification.data.documentType : '';
      const documentRoute = documentRouteByType[documentType];

      if (notification.data.action === 'resubmit_document' && documentRoute) {
        router.push(`/profile/documents/${documentRoute}` as Href);
        return;
      }

      router.push('/profile/documents' as Href);
      return;
    }

    if (
      (notification.data?.action === 'pay_balance' || notification.data?.action === 'pay_outstanding') &&
      notification.bookingId
    ) {
      router.push(`/bookings/payment?bookingId=${encodeURIComponent(notification.bookingId)}` as Href);
      return;
    }

    if (notification.bookingId) {
      // Resolve the booking through the service instead of trusting notification
      // text or an old status. The tab rechecks server handover eligibility.
      const booking = await getBooking(notification.bookingId).catch(() => null);
      if (booking && canSelectTelematicsBooking(booking)) {
        router.push(`/telematics/${encodeURIComponent(booking.id)}` as Href);
        return;
      }
      router.push(`/bookings/${encodeURIComponent(notification.bookingId)}` as Href);
      return;
    }

    router.push('/(tabs)/bookings' as Href);
  };

  const rejectionReason = selectedNotification?.data?.rejectionReason;

  return (
    <NotificationFeed
      header={<CustomerTabHeader title="Notifications" showLogout />}
      notifications={notifications}
      unreadCount={unreadCount}
      hasMore={hasMore}
      isExpanded={isExpanded}
      isLoadingMore={isLoadingMore}
      loadMoreError={loadMoreError}
      onViewAll={viewAllNotifications}
      onLoadMore={() => void loadOlderNotifications()}
      onRetryLoadMore={() => void loadOlderNotifications(true)}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={() => void loadNotifications()}
      actionError={actionError}
      isMarkingAllRead={isMarkingAllRead}
      onMarkAllRead={() => void markAllRead()}
      onOpen={(notification) => void openNotification(notification)}>
      <NotificationDetailModal
        notification={selectedNotification}
        onAction={(notification) => {
          void handleNotificationAction(notification).catch(() => {
            reportActionError('The notification action could not be opened. Please try again.');
          });
        }}
        onClose={closeNotification}
        actionLabel={selectedNotification
          ? selectedNotification.data?.action === 'view_delivery_quote'
            ? 'Start Booking'
            : selectedNotification.actionLabel ?? getDefaultActionLabel(selectedNotification.category)
          : 'View Details'}
        detailRows={[
          { label: 'Booking ID', value: selectedNotification?.bookingId },
          { label: 'Vehicle', value: selectedNotification?.vehicleName },
          { label: 'Payment', value: selectedNotification?.paymentStatus },
          { label: 'Rental status', value: selectedNotification?.tripStatus },
          { label: 'Document Status', value: getDocumentStatusLabel(selectedNotification?.data?.documentStatus) },
          { label: 'Review Result', value: typeof rejectionReason === 'string' ? rejectionReason : undefined },
        ]}
      />
    </NotificationFeed>
  );
}
