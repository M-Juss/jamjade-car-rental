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
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import type { MobileNotificationRecord } from '@/services/api';

type NotificationCategory = MobileNotificationRecord['category'];

type CategoryConfig = {
  icon: LucideIcon;
  iconColor: string;
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const categoryConfig: Record<NotificationCategory, CategoryConfig> = {
  booking: {
    icon: CalendarCheck,
    iconColor: themeColors.primary,
  },
  payment: {
    icon: CreditCard,
    iconColor: themeColors.success,
  },
  vehicle: {
    icon: Car,
    iconColor: themeColors.primary,
  },
  trip: {
    icon: Navigation,
    iconColor: themeColors.warning,
  },
  system: {
    icon: FileText,
    iconColor: themeColors.mutedForeground,
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
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt));
}

function NotificationCard({
  notification,
  onOpen,
}: {
  notification: MobileNotificationRecord;
  onOpen: (notification: MobileNotificationRecord) => void;
}) {
  const category = categoryConfig[notification.category];
  const Icon = category.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open notification: ${notification.title}${notification.isRead ? '' : ', unread'}`}
      onPress={() => onOpen(notification)}
      className={cx(
        'min-h-control flex-row items-start gap-3 border-b border-border px-card py-3',
        !notification.isRead && 'bg-muted/45',
      )}>
      <View className="pt-1">
        <Icon size={19} color={category.iconColor} strokeWidth={2.35} />
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-start gap-2">
          <Text
            className={cx(
              'font-sans',
              'min-w-0 flex-1 text-[14px] leading-5 text-foreground',
              notification.isRead ? 'font-medium' : 'font-semibold',
            )}
            numberOfLines={1}>
            {notification.title}
          </Text>
          {!notification.isRead ? (
            <View accessibilityLabel="Unread" className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </View>

        <Text
          className="font-sans mt-0.5 text-[13px] leading-[18px] text-secondary-foreground"
          numberOfLines={2}>
          {notification.message}
        </Text>

        <Text className="font-sans mt-1 text-[12px] text-secondary-foreground">
          {formatTimeAgo(notification.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function NotificationDetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-border py-3">
      <Text className="font-sans min-w-0 flex-1 text-caption text-secondary-foreground">{label}</Text>
      <Text className="font-sans max-w-[58%] shrink text-right text-body text-foreground">
        {value}
      </Text>
    </View>
  );
}

export function NotificationDetailModal({
  notification,
  onAction,
  onClose,
  actionLabel,
  detailRows,
}: {
  notification: MobileNotificationRecord | null;
  actionLabel: string;
  detailRows: { label: string; value?: string | null }[];
  onClose: () => void;
  onAction: (notification: MobileNotificationRecord) => void;
}) {
  const insets = useSafeAreaInsets();
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
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
  const isDrivingReport = notification.data?.event_type === 'driving_report_ready';

  return (
    <Modal accessibilityViewIsModal animationType="slide" transparent visible={Boolean(notification)} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-foreground/45">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close notification detail"
          className="absolute inset-0"
          onPress={onClose}
        />

        <View
          className="max-h-[88%] rounded-t-sheet bg-background px-screen pt-4"
          style={{ paddingBottom: insets.bottom + 18 }}>
          <View
            {...sheetPanResponder.panHandlers}
            accessibilityHint="Swipe down to close notification details"
            className="items-center pb-3 pt-2">
            <View className="h-1.5 w-12 rounded-full bg-border" />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text accessibilityRole="header" className="font-sans mt-1 text-[20px] font-semibold leading-7 text-foreground">
              {notification.title}
            </Text>
            {isDrivingReport ? <Text className="font-sans mt-3 text-body leading-6 text-foreground">
              {notification.fullMessage}
            </Text> : <>
            <View className="mt-3 gap-3">
              {notification.fullMessage.split(/\n\s*\n|\r?\n/).filter(paragraph => paragraph.trim()).map((paragraph, index) => (
                <Text key={index} className="font-sans text-[16px] font-normal leading-7 text-foreground">
                  {paragraph.trim()}
                </Text>
              ))}
            </View>

            <View className="mt-section rounded-card border border-border bg-surface px-4">
              <NotificationDetailRow label="Date" value={formatDateTime(notification.createdAt)} />
              {detailRows.map((row) => (
                <NotificationDetailRow key={row.label} {...row} />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => onAction(notification)}
              className="mt-section min-h-control flex-row items-center justify-center gap-2 rounded-field bg-primary px-4 py-3">
              <Info size={18} color={themeColors.surface} strokeWidth={2.5} />
              <Text className="font-sans shrink text-center text-button font-medium text-surface">
                {actionLabel}
              </Text>
            </Pressable>
            </>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function NotificationEmptyState() {
  return (
    <View className="items-center rounded-card border border-border bg-surface px-card py-6">
      <Bell size={24} color={themeColors.primary} strokeWidth={2} />
      <Text className="font-sans mt-4 text-center text-[20px] font-semibold text-foreground">
        No notifications found
      </Text>
      <Text className="font-sans mt-2 text-center text-[14px] font-normal leading-5 text-secondary-foreground">
        New updates will appear here.
      </Text>
    </View>
  );
}

function NotificationSkeletonCard() {
  return (
    <View className="flex-row items-start gap-3 border-b border-border px-4 py-3.5">
      <View className="h-10 w-10 rounded-full bg-muted" />
      <View className="min-w-0 flex-1">
        <View className="h-5 w-3/4 rounded-full bg-muted" />
        <View className="mt-2 h-4 w-full rounded-full bg-muted/60" />
        <View className="mt-1.5 h-4 w-5/6 rounded-full bg-muted/60" />
      </View>
    </View>
  );
}

function NotificationLoadingState() {
  return (
    <View className="overflow-hidden rounded-card border border-border bg-surface">
      {[1, 2, 3, 4].map((item) => (
        <NotificationSkeletonCard key={item} />
      ))}
    </View>
  );
}

type NotificationFeedProps = {
  header: ReactNode;
  notifications: MobileNotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  loadError: string | null;
  actionError?: string | null;
  isMarkingAllRead?: boolean;
  hasMore: boolean;
  isExpanded: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  onViewAll: () => void;
  onLoadMore: () => void;
  onRetryLoadMore: () => void;
  onRetry: () => void;
  onMarkAllRead: () => void;
  onOpen: (notification: MobileNotificationRecord) => void;
  children?: ReactNode;
};

export function NotificationFeed({
  header, notifications, unreadCount, isLoading, loadError, actionError,
  isMarkingAllRead = false, hasMore, isExpanded, isLoadingMore, loadMoreError,
  onViewAll, onLoadMore, onRetryLoadMore, onRetry, onMarkAllRead, onOpen, children,
}: NotificationFeedProps) {
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<MobileNotificationRecord>>(null);
  const userScrolled = useRef(false);
  useEffect(() => {
    if (isLoading) {
      userScrolled.current = false;
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [isLoading]);
  const retry = () => {
    userScrolled.current = false;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    onRetry();
  };

  return (
    <View className="flex-1 bg-background">
      <FlatList
        ref={list}
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[560px] self-center px-screen"
        contentContainerStyle={{ paddingBottom: floatingTabBarContentPadding + insets.bottom, paddingTop: insets.top + 10 }}
        data={isLoading ? [] : notifications}
        keyExtractor={(notification) => notification.id}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={7}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => { userScrolled.current = true; }}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 160;
          if (!nearBottom || !userScrolled.current || !isExpanded || isLoadingMore || loadMoreError || !hasMore) return;
          userScrolled.current = false;
          onLoadMore();
        }}
        ListHeaderComponent={<>
          {header}
          <View className="mb-2 mt-2 flex-row items-center justify-between gap-3 px-1">
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View className={cx('h-2 w-2 rounded-full', unreadCount > 0 ? 'bg-primary' : 'bg-border')} />
              <Text className="font-sans text-[12px] font-medium text-secondary-foreground" numberOfLines={1}>
                {isLoading ? 'Loading updates…' : loadError ? 'Updates unavailable' : unreadCount > 0
                  ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
                  : 'All caught up'}
              </Text>
            </View>
            {unreadCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading || isMarkingAllRead, busy: isMarkingAllRead }}
                disabled={isLoading || isMarkingAllRead}
                onPress={onMarkAllRead}
                className="min-h-control justify-center px-1">
                <Text className="font-sans text-[12px] font-medium text-primary">
                  {isMarkingAllRead ? 'Marking…' : 'Mark all read'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {loadError ? (
            <View className="mb-2 rounded-card border border-destructive-border bg-destructive-surface p-4">
              <Text accessibilityRole="alert" className="font-sans text-[13px] font-medium text-destructive">{loadError}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry loading notifications" onPress={retry}
                className="mt-3 min-h-control items-center justify-center rounded-field border border-border bg-surface px-4">
                <Text className="font-sans text-[13px] font-semibold text-primary">Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {actionError ? <Text accessibilityRole="alert" className="font-sans mb-2 text-[13px] font-medium text-destructive">{actionError}</Text> : null}
        </>}
        renderItem={({ item, index }) => (
          <View className={cx('overflow-hidden border-x border-border bg-surface', index === 0 && 'rounded-t-card border-t', index === notifications.length - 1 && 'rounded-b-card')}>
            <NotificationCard notification={item} onOpen={onOpen} />
          </View>
        )}
        ListEmptyComponent={isLoading ? <NotificationLoadingState /> : !loadError ? <NotificationEmptyState /> : null}
        ListFooterComponent={!isLoading && notifications.length > 0 ? (
          <View className="mt-3">
            {isLoadingMore ? (
              <View accessibilityRole="progressbar" accessibilityLabel="Loading older notifications" className="min-h-control items-center justify-center">
                <ActivityIndicator color={themeColors.primary} />
              </View>
            ) : loadMoreError ? (
              <View className="gap-1">
                <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{loadMoreError}</Text>
                <Pressable accessibilityRole="button" onPress={onRetryLoadMore} className="min-h-control items-center justify-center rounded-field border border-border bg-surface">
                  <Text className="font-sans text-body font-medium text-primary">Retry</Text>
                </Pressable>
              </View>
            ) : hasMore && !isExpanded ? (
              <Pressable accessibilityRole="button" onPress={onViewAll} className="min-h-control items-center justify-center rounded-field border border-border bg-surface">
                <Text className="font-sans text-body font-medium text-primary">View all notifications</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      />
      {children}
    </View>
  );
}
