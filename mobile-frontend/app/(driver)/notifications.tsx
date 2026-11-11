import { useRouter, type Href } from 'expo-router';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { NotificationDetailModal, NotificationFeed } from '@/components/notifications/NotificationFeed';
import { useNotifications } from '@/hooks/use-notifications';
import type { MobileNotificationRecord } from '@/services/api';

export default function DriverNotificationsScreen() {
  const router = useRouter();
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

  const handleAction = (notification: MobileNotificationRecord) => {
    closeNotification();
    try {
      if (notification.data?.action === 'pay_outstanding' && notification.bookingId) {
        router.push(`/driver-payment?bookingId=${encodeURIComponent(notification.bookingId)}` as Href);
        return;
      }
      if (notification.data?.action === 'view_telematics_activity' && notification.bookingId) {
        router.push(`/driver-telematics/${encodeURIComponent(notification.bookingId)}?tab=activity` as Href);
        return;
      }
      if (notification.bookingId) {
        router.push(`/driver-services/${encodeURIComponent(notification.bookingId)}` as Href);
        return;
      }
      router.push('/(driver)/services');
    } catch {
      reportActionError('The notification action could not be opened. Please try again.');
    }
  };

  return (
    <NotificationFeed
      header={<CustomerTabHeader title="Notifications" showLogout={false} />}
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
      actionError={actionError}
      isMarkingAllRead={isMarkingAllRead}
      onRetry={() => void loadNotifications()}
      onMarkAllRead={() => void markAllRead()}
      onOpen={(notification) => void openNotification(notification)}>
      <NotificationDetailModal
        notification={selectedNotification}
        onAction={handleAction}
        onClose={closeNotification}
        actionLabel={selectedNotification?.actionLabel ?? (
          selectedNotification?.data?.action === 'pay_outstanding' ? 'Review & Pay'
            : selectedNotification?.data?.action === 'view_telematics_activity' ? 'View activity'
              : selectedNotification?.bookingId ? 'View service' : 'View Services'
        )}
        detailRows={[
          { label: 'Booking ID', value: selectedNotification?.bookingId },
          { label: 'Vehicle', value: selectedNotification?.vehicleName },
          { label: 'Service Status', value: selectedNotification?.tripStatus },
        ]}
      />
    </NotificationFeed>
  );
}
