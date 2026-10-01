import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import {
  Bell,
  CalendarCheck,
  Car,
  CreditCard,
  FileText,
  Info,
  Navigation,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { setUnreadNotificationCount } from '@/lib/customer/notification-unread';
import { useAuth } from '@/providers/AuthProvider';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/api';

type NotificationCategory = 'booking' | 'payment' | 'vehicle' | 'trip' | 'system';
type NotificationPriority = 'normal' | 'success' | 'warning' | 'urgent';

type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  fullMessage: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  bookingId?: string;
  vehicleName?: string;
  paymentStatus?: string;
  tripStatus?: string;
  actionLabel?: string;
  data?: Record<string, unknown>;
};

const documentRouteByType: Record<string, string> = {
  drivers_license: 'driver-license',
  passport: 'passport',
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

type CategoryConfig = {
  label: string;
  icon: LucideIcon;
  iconWrapClass: string;
  iconColor: string;
};

type PriorityConfig = {
  label: string;
  dotClass: string;
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const categoryConfig: Record<NotificationCategory, CategoryConfig> = {
  booking: {
    label: 'Booking',
    icon: CalendarCheck,
    iconWrapClass: 'bg-muted',
    iconColor: '#346EF6',
  },
  payment: {
    label: 'Payment',
    icon: CreditCard,
    iconWrapClass: 'bg-success-surface',
    iconColor: '#047857',
  },
  vehicle: {
    label: 'Vehicle',
    icon: Car,
    iconWrapClass: 'bg-muted',
    iconColor: '#1F58E7',
  },
  trip: {
    label: 'Trip',
    icon: Navigation,
    iconWrapClass: 'bg-warning-surface',
    iconColor: '#C2410C',
  },
  system: {
    label: 'System',
    icon: FileText,
    iconWrapClass: 'bg-[#F3F4F6]',
    iconColor: '#4B5563',
  },
};

const priorityConfig: Record<NotificationPriority, PriorityConfig> = {
  normal: {
    label: 'Normal',
    dotClass: 'bg-primary',
  },
  success: {
    label: 'Success',
    dotClass: 'bg-[#16A34A]',
  },
  warning: {
    label: 'Warning',
    dotClass: 'bg-[#F59E0B]',
  },
  urgent: {
    label: 'Urgent',
    dotClass: 'bg-destructive',
  },
};

function formatTimeAgo(createdAt: string) {
  const elapsedMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const minutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${days}d ago`;
}

function formatDateTime(createdAt: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt));
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

function NotificationHeader() {
  return (
    <CustomerTabHeader title="Notifications" />
  );
}

function NotificationCard({
  notification,
  onOpen,
}: {
  notification: CustomerNotification;
  onOpen: (notification: CustomerNotification) => void;
}) {
  const category = categoryConfig[notification.category];
  const Icon = category.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open notification: ${notification.title}`}
      onPress={() => onOpen(notification)}
      className={cx(
        'min-h-[100px] flex-row items-center gap-3 border-b border-border px-4 py-2',
        !notification.isRead && 'bg-muted/45',
      )}>
      <View className={cx('h-10 w-10 self-center items-center justify-center rounded-full', category.iconWrapClass)}>
        <Icon size={19} color={category.iconColor} strokeWidth={2.35} />
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-start gap-2">
          <Text
            className={cx(
              'min-w-0 flex-1 text-[14px] leading-5 text-foreground',
              notification.isRead ? 'font-bold' : 'font-black',
            )}
            numberOfLines={1}>
            {notification.title}
          </Text>
          {!notification.isRead ? <View accessibilityLabel="Unread" className="mt-1.5 h-2 w-2 rounded-full bg-primary" /> : null}
        </View>

        <Text className="mt-0.5 min-h-[36px] text-[12px] font-medium leading-[18px] text-muted-foreground" numberOfLines={2}>
          {notification.message}
        </Text>

        <Text className="mt-1 text-[10px] font-semibold text-subtle-foreground">
          {formatTimeAgo(notification.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function NotificationDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) {
    return null;
  }

  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-border py-3">
      <Text className="w-[112px] text-[11px] font-black uppercase text-subtle-foreground">{label}</Text>
      <Text className="min-w-0 flex-1 text-right text-[13px] font-bold leading-5 text-foreground">{value}</Text>
    </View>
  );
}

function NotificationDetailModal({
  notification,
  onAction,
  onClose,
}: {
  notification: CustomerNotification | null;
  onClose: () => void;
  onAction: (notification: CustomerNotification) => void;
}) {
  const insets = useSafeAreaInsets();
  const sheetPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 6 && gestureState.dy > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 72 || gestureState.vy > 0.65) {
          onClose();
        }
      },
    }),
    [onClose],
  );

  if (!notification) {
    return null;
  }

  const category = categoryConfig[notification.category];
  const priority = priorityConfig[notification.priority];
  const rejectionReason =
    typeof notification.data?.rejectionReason === 'string'
      ? notification.data.rejectionReason
      : undefined;

  return (
    <Modal animationType="slide" transparent visible={Boolean(notification)} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-[#081A33]/45">
        <Pressable accessibilityLabel="Close notification detail" className="absolute inset-0" onPress={onClose} />

        <View
          className="max-h-[88%] rounded-t-[34px] bg-background px-5 pt-4"
          style={{ paddingBottom: insets.bottom + 18 }}>
          <View
            {...sheetPanResponder.panHandlers}
            accessibilityHint="Swipe down to close notification details"
            className="items-center pb-3 pt-2">
            <View className="h-1.5 w-12 rounded-full bg-[#C8D4E8]" />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text className="mt-1 text-[24px] font-black leading-[29px] text-foreground">{notification.title}</Text>
            <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#53647F]">{notification.fullMessage}</Text>

            <View className="mt-4 flex-row items-center gap-2">
              <View className={cx('h-2.5 w-2.5 rounded-full', priority.dotClass)} />
              <Text className="text-[12px] font-bold text-muted-foreground">
                {category.label} · {priority.label} · {notification.isRead ? 'Read' : 'Unread'}
              </Text>
            </View>

            <View className="mt-5 rounded-[26px] border border-border bg-surface px-4">
              <NotificationDetailRow label="Date" value={formatDateTime(notification.createdAt)} />
              <NotificationDetailRow label="Booking ID" value={notification.bookingId} />
              <NotificationDetailRow label="Vehicle" value={notification.vehicleName} />
              <NotificationDetailRow label="Payment" value={notification.paymentStatus} />
              <NotificationDetailRow label="Trip Status" value={notification.tripStatus} />
              <NotificationDetailRow
                label="Document Status"
                value={getDocumentStatusLabel(notification.data?.documentStatus)}
              />
              <NotificationDetailRow label="Review Result" value={rejectionReason} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => onAction(notification)}
              className="mt-5 min-h-[54px] flex-row items-center justify-center gap-2 rounded-full bg-[#065F46] px-4">
              <Info size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-[14px] font-black text-surface" numberOfLines={1}>
                {notification.actionLabel ?? getDefaultActionLabel(notification.category)}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function NotificationEmptyState() {
  return (
    <View className="items-center rounded-[32px] border border-dashed border-[#C8D4E8] bg-surface p-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Bell size={30} color="#346EF6" strokeWidth={2.25} />
      </View>
      <Text className="mt-4 text-center text-[20px] font-black text-foreground">No notifications found</Text>
      <Text className="mt-2 text-center text-[14px] font-semibold leading-5 text-muted-foreground">
        You are all caught up. New updates will appear here.
      </Text>
    </View>
  );
}

function NotificationSkeletonCard() {
  return (
    <View className="flex-row items-start gap-3 border-b border-border px-4 py-3.5">
      <View className="h-10 w-10 rounded-full bg-[#E9EFFA]" />
      <View className="min-w-0 flex-1">
        <View className="h-5 w-3/4 rounded-full bg-[#E9EFFA]" />
        <View className="mt-2 h-4 w-full rounded-full bg-[#EEF3FB]" />
        <View className="mt-1.5 h-4 w-5/6 rounded-full bg-[#EEF3FB]" />
      </View>
    </View>
  );
}

function NotificationLoadingState() {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-surface">
      {[1, 2, 3, 4].map((item) => (
        <NotificationSkeletonCard key={item} />
      ))}
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<CustomerNotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setNotifications([]);

    try {
      setNotifications(await getNotifications());
    } catch {
      setLoadError('Notifications could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    if (!isLoading) {
      setUnreadNotificationCount(unreadCount);
    }
  }, [isLoading, unreadCount]);

  const orderedNotifications = useMemo(
    () => [...notifications].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    [notifications],
  );

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, isRead: true })),
    );
    setSelectedNotification((currentNotification) =>
      currentNotification ? { ...currentNotification, isRead: true } : currentNotification,
    );
  };

  const handleOpenNotification = (notification: CustomerNotification) => {
    if (!notification.isRead) {
      void markNotificationAsRead(notification.id).then((readNotification) => {
        setNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            currentNotification.id === notification.id ? readNotification : currentNotification,
          ),
        );
        setSelectedNotification(readNotification);
      });
      return;
    }

    setSelectedNotification(notification);
  };

  const handleNotificationAction = async (notification: CustomerNotification) => {
    setSelectedNotification(null);

    if (
      notification.data?.action === 'view_documents' ||
      notification.data?.action === 'resubmit_document'
    ) {
      await refreshProfile().catch(() => undefined);

      const documentType =
        typeof notification.data.documentType === 'string'
          ? notification.data.documentType
          : '';
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
      router.push(`/bookings/${encodeURIComponent(notification.bookingId)}` as Href);
      return;
    }

    router.push('/(tabs)/bookings' as Href);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <NotificationHeader />

          <View className="mt-2 flex-row items-center justify-between gap-3 px-1">
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View className={cx('h-2 w-2 rounded-full', unreadCount > 0 ? 'bg-primary' : 'bg-border')} />
              <Text className="text-[12px] font-bold text-muted-foreground" numberOfLines={1}>
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
              </Text>
              {unreadCount > 0 ? (
                <Pressable accessibilityRole="button" onPress={handleMarkAllAsRead} className="min-h-[36px] justify-center px-1">
                  <Text className="text-[11px] font-bold text-primary">Mark all read</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => void loadNotifications()} className="min-h-[36px] justify-center px-1">
              <Text className="text-[12px] font-bold text-primary">Refresh</Text>
            </Pressable>
          </View>

          <View className="mt-2 gap-2">
            {loadError ? (
              <View className="rounded-[24px] border border-destructive-border bg-destructive-surface p-4">
                <Text className="text-[13px] font-bold text-destructive">{loadError}</Text>
              </View>
            ) : null}
            {isLoading ? (
              <NotificationLoadingState />
            ) : orderedNotifications.length > 0 ? (
              <View className="overflow-hidden rounded-2xl border border-border bg-surface">
                {orderedNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onOpen={handleOpenNotification}
                  />
                ))}
              </View>
            ) : (
              <NotificationEmptyState />
            )}
          </View>
        </View>
      </ScrollView>

      <NotificationDetailModal
        notification={selectedNotification}
        onAction={handleNotificationAction}
        onClose={() => setSelectedNotification(null)}
      />
    </View>
  );
}
