import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import {
  Bell,
  CalendarCheck,
  Car,
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  Navigation,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
type NotificationFilter = 'all' | NotificationCategory;
type NotificationReadStatus = 'all' | 'unread' | 'read';
type NotificationPriorityFilter = 'all' | NotificationPriority;

type NotificationStatusFilters = {
  readStatus: NotificationReadStatus;
  priority: NotificationPriorityFilter;
};

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
  badgeClass: string;
  badgeTextClass: string;
};

type PriorityConfig = {
  label: string;
  dotClass: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
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
    badgeClass: 'bg-muted border-border',
    badgeTextClass: 'text-primary',
  },
  payment: {
    label: 'Payment',
    icon: CreditCard,
    iconWrapClass: 'bg-success-surface',
    iconColor: '#047857',
    badgeClass: 'bg-success-surface border-success-border',
    badgeTextClass: 'text-success',
  },
  vehicle: {
    label: 'Vehicle',
    icon: Car,
    iconWrapClass: 'bg-muted',
    iconColor: '#1F58E7',
    badgeClass: 'bg-muted border-border',
    badgeTextClass: 'text-primary',
  },
  trip: {
    label: 'Trip',
    icon: Navigation,
    iconWrapClass: 'bg-warning-surface',
    iconColor: '#C2410C',
    badgeClass: 'bg-warning-surface border-warning-border',
    badgeTextClass: 'text-warning',
  },
  system: {
    label: 'System',
    icon: FileText,
    iconWrapClass: 'bg-[#F3F4F6]',
    iconColor: '#4B5563',
    badgeClass: 'bg-[#F3F4F6] border-[#E5E7EB]',
    badgeTextClass: 'text-[#4B5563]',
  },
};

const priorityConfig: Record<NotificationPriority, PriorityConfig> = {
  normal: {
    label: 'Normal',
    dotClass: 'bg-primary',
    badgeClass: 'bg-muted border-border',
    textClass: 'text-primary',
    borderClass: 'border-l-primary',
  },
  success: {
    label: 'Success',
    dotClass: 'bg-[#16A34A]',
    badgeClass: 'bg-success-surface border-success-border',
    textClass: 'text-success',
    borderClass: 'border-l-[#16A34A]',
  },
  warning: {
    label: 'Warning',
    dotClass: 'bg-[#F59E0B]',
    badgeClass: 'bg-[#FFFBEB] border-[#FDE68A]',
    textClass: 'text-[#B45309]',
    borderClass: 'border-l-[#F59E0B]',
  },
  urgent: {
    label: 'Urgent',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive-surface border-destructive-border',
    textClass: 'text-destructive',
    borderClass: 'border-l-destructive',
  },
};

const filterTabs: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'booking', label: 'Booking' },
  { key: 'payment', label: 'Payment' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'trip', label: 'Trip' },
  { key: 'system', label: 'System' },
];

const defaultStatusFilters: NotificationStatusFilters = {
  readStatus: 'all',
  priority: 'all',
};

const readStatusOptions: { label: string; value: NotificationReadStatus }[] = [
  { label: 'All Status', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

const priorityStatusOptions: { label: string; value: NotificationPriorityFilter }[] = [
  { label: 'All Priority', value: 'all' },
  { label: 'Normal', value: 'normal' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Urgent', value: 'urgent' },
];

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

function matchesNotificationSearch(notification: CustomerNotification, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    notification.title,
    notification.message,
    notification.fullMessage,
    notification.category,
    notification.bookingId,
    notification.vehicleName,
    notification.paymentStatus,
    notification.tripStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

function matchesNotificationStatusFilters(
  notification: CustomerNotification,
  filters: NotificationStatusFilters,
) {
  const matchesReadStatus =
    filters.readStatus === 'all' ||
    (filters.readStatus === 'read' && notification.isRead) ||
    (filters.readStatus === 'unread' && !notification.isRead);
  const matchesPriority = filters.priority === 'all' || notification.priority === filters.priority;

  return matchesReadStatus && matchesPriority;
}

function NotificationHeader({
  unreadCount,
  onMarkAllAsRead,
}: {
  unreadCount: number;
  onMarkAllAsRead: () => void;
}) {
  return (
    <View>
      <CustomerTabHeader description="Catch booking, payment, and trip updates" />

      <View className="mt-4 flex-row items-center justify-between gap-3 rounded-[24px] border border-border bg-surface px-4 py-3 shadow-sm shadow-foreground/5">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View className={cx('h-3 w-3 rounded-full', unreadCount > 0 ? 'bg-primary' : 'bg-border')} />
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[0.45px] text-subtle-foreground">Unread updates</Text>
            <Text className="mt-0.5 text-[15px] font-black text-foreground" numberOfLines={1}>
              {unreadCount > 0 ? `${unreadCount} need attention` : 'All caught up'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={unreadCount === 0}
          onPress={onMarkAllAsRead}
          className={cx(
            'min-h-[40px] flex-row items-center justify-center gap-1.5 rounded-full px-3.5',
            unreadCount > 0 ? 'bg-primary' : 'bg-[#F1F5F9]',
          )}>
          <CheckCircle2 size={15} color={unreadCount > 0 ? '#FFFFFF' : '#94A3B8'} strokeWidth={2.5} />
          <Text className={cx('text-[12px] font-black', unreadCount > 0 ? 'text-surface' : 'text-subtle-foreground')}>
            {unreadCount > 0 ? 'Mark read' : 'All read'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NotificationSearchBar({
  activeFilterCount = 0,
  onFilterPress,
  onSearchChange,
  value,
}: {
  activeFilterCount?: number;
  value: string;
  onSearchChange: (value: string) => void;
  onFilterPress: () => void;
}) {
  return (
    <View className="min-h-[56px] flex-row items-center rounded-full border border-border bg-surface px-4 shadow-md shadow-foreground/5">
      <Search size={20} color="#7B879C" strokeWidth={2.3} />
      <TextInput
        value={value}
        onChangeText={onSearchChange}
        placeholder="Search notifications..."
        placeholderTextColor="#9AA4B8"
        className="min-w-0 flex-1 px-3 text-[14px] font-semibold text-foreground"
      />
      {value.trim() ? (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onSearchChange('')}
          className="h-9 w-9 items-center justify-center rounded-full bg-muted">
          <X size={16} color="#346EF6" strokeWidth={2.5} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount > 0 ? `Open filters, ${activeFilterCount} active` : 'Open filters'}
        hitSlop={8}
        onPress={onFilterPress}
        className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-muted">
        <SlidersHorizontal size={18} color="#346EF6" strokeWidth={2.5} />
        {activeFilterCount > 0 ? (
          <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
            <Text className="text-[10px] font-black text-surface">{activeFilterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function FilterGroup({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-3 text-[13px] font-black uppercase tracking-[0.9px] text-subtle-foreground">{title}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function FilterChip({
  isSelected,
  label,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cx(
        'rounded-full border px-4 py-2.5',
        isSelected ? 'border-primary bg-primary' : 'border-border bg-surface',
      )}>
      <Text className={cx('text-[13px] font-black', isSelected ? 'text-surface' : 'text-foreground')}>{label}</Text>
    </Pressable>
  );
}

function NotificationFilterSheet({
  categoryFilter,
  filters,
  onApply,
  onClose,
  visible,
}: {
  visible: boolean;
  categoryFilter: NotificationFilter;
  filters: NotificationStatusFilters;
  onApply: (categoryFilter: NotificationFilter, filters: NotificationStatusFilters) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draftCategory, setDraftCategory] = useState<NotificationFilter>(categoryFilter);
  const [draftFilters, setDraftFilters] = useState<NotificationStatusFilters>(filters);

  useEffect(() => {
    if (visible) {
      setDraftCategory(categoryFilter);
      setDraftFilters(filters);
    }
  }, [categoryFilter, filters, visible]);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-[#0B1220]/45" onPress={onClose}>
        <Pressable className="max-h-[86%] rounded-t-[32px] bg-surface px-5 pt-4" style={{ paddingBottom: insets.bottom + 28 }}>
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-[#D7DDE8]" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[22px] font-black text-foreground">Filters</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F6FB]">
              <X size={19} color="#17315F" strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <FilterGroup title="Notification type">
              {filterTabs.map((filter) => (
                <FilterChip
                  key={filter.key}
                  label={filter.label}
                  isSelected={draftCategory === filter.key}
                  onPress={() => setDraftCategory(filter.key)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Read status">
              {readStatusOptions.map((status) => (
                <FilterChip
                  key={status.value}
                  label={status.label}
                  isSelected={draftFilters.readStatus === status.value}
                  onPress={() => setDraftFilters((current) => ({ ...current, readStatus: status.value }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Priority status">
              {priorityStatusOptions.map((status) => (
                <FilterChip
                  key={status.value}
                  label={status.label}
                  isSelected={draftFilters.priority === status.value}
                  onPress={() => setDraftFilters((current) => ({ ...current, priority: status.value }))}
                />
              ))}
            </FilterGroup>
          </ScrollView>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setDraftCategory('all');
                setDraftFilters(defaultStatusFilters);
              }}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full border border-border bg-surface">
              <Text className="text-[15px] font-black text-foreground">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onApply(draftCategory, draftFilters);
                onClose();
              }}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full bg-primary">
              <Text className="text-[15px] font-black text-surface">Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NotificationBadge({
  children,
  className,
  textClassName,
}: {
  children: string;
  className: string;
  textClassName: string;
}) {
  return (
    <View className={cx('rounded-full border px-2.5 py-1', className)}>
      <Text className={cx('text-[10px] font-black uppercase', textClassName)} numberOfLines={1}>
        {children}
      </Text>
    </View>
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
        'overflow-hidden rounded-[24px] border bg-surface p-4 shadow-md shadow-foreground/6',
        notification.isRead ? 'border-border' : 'border-[#BFD5FF]',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('h-11 w-11 items-center justify-center rounded-full', category.iconWrapClass)}>
          <Icon size={20} color={category.iconColor} strokeWidth={2.45} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <Text
              className={cx(
                'min-w-0 flex-1 text-[16px] leading-5 text-foreground',
                notification.isRead ? 'font-extrabold' : 'font-black',
              )}
              numberOfLines={2}>
              {notification.title}
            </Text>
            {!notification.isRead ? <View className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
          </View>

          <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#53647F]" numberOfLines={2}>
            {notification.message}
          </Text>

          <View className="mt-3 flex-row items-center justify-between gap-3">
            <NotificationBadge className={category.badgeClass} textClassName={category.badgeTextClass}>
              {category.label}
            </NotificationBadge>
            <Text className="min-w-0 flex-1 text-right text-[12px] font-bold text-subtle-foreground" numberOfLines={1}>
              {formatTimeAgo(notification.createdAt)}
            </Text>
          </View>
        </View>
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

  if (!notification) {
    return null;
  }

  const category = categoryConfig[notification.category];
  const priority = priorityConfig[notification.priority];
  const Icon = category.icon;
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
          <View className="items-center">
            <View className="h-1.5 w-12 rounded-full bg-[#C8D4E8]" />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <View className="mt-5 flex-row items-start justify-between gap-3">
              <View className={cx('h-14 w-14 items-center justify-center rounded-full', category.iconWrapClass)}>
                <Icon size={27} color={category.iconColor} strokeWidth={2.45} />
              </View>

              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                <X size={18} color="#17315F" strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text className="mt-4 text-[24px] font-black leading-[29px] text-foreground">{notification.title}</Text>
            <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#53647F]">{notification.fullMessage}</Text>

            <View className="mt-4 flex-row flex-wrap items-center gap-2">
              <View className={cx('h-2.5 w-2.5 rounded-full', priority.dotClass)} />
              <NotificationBadge className={category.badgeClass} textClassName={category.badgeTextClass}>
                {category.label}
              </NotificationBadge>
              <NotificationBadge className={priority.badgeClass} textClassName={priority.textClass}>
                {priority.label}
              </NotificationBadge>
              <NotificationBadge className="border-border bg-surface" textClassName="text-muted-foreground">
                {notification.isRead ? 'Read' : 'Unread'}
              </NotificationBadge>
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

function NotificationEmptyState({
  onClearFilters,
  showClearFilters,
}: {
  showClearFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <View className="items-center rounded-[32px] border border-dashed border-[#C8D4E8] bg-surface p-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Bell size={30} color="#346EF6" strokeWidth={2.25} />
      </View>
      <Text className="mt-4 text-center text-[20px] font-black text-foreground">No notifications found</Text>
      <Text className="mt-2 text-center text-[14px] font-semibold leading-5 text-muted-foreground">
        You are all caught up. New updates will appear here.
      </Text>
      {showClearFilters ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearFilters}
          className="mt-6 min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-[#065F46] px-6">
          <X size={17} color="#FFFFFF" strokeWidth={2.45} />
          <Text className="text-[15px] font-black text-surface">Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationSkeletonCard() {
  return (
    <View className="overflow-hidden rounded-[28px] border border-border bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 rounded-full bg-[#E9EFFA]" />
        <View className="min-w-0 flex-1">
          <View className="h-5 w-3/4 rounded-full bg-[#E9EFFA]" />
          <View className="mt-3 h-4 w-full rounded-full bg-[#EEF3FB]" />
          <View className="mt-2 h-4 w-5/6 rounded-full bg-[#EEF3FB]" />
          <View className="mt-4 flex-row gap-2">
            <View className="h-7 w-20 rounded-full bg-[#E9EFFA]" />
            <View className="h-7 w-24 rounded-full bg-[#EEF3FB]" />
          </View>
        </View>
      </View>
    </View>
  );
}

function NotificationLoadingState() {
  return (
    <View className="gap-5">
      <Text className="text-[13px] font-bold text-muted-foreground">Loading your notifications...</Text>
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
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [statusFilters, setStatusFilters] = useState<NotificationStatusFilters>(defaultStatusFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<CustomerNotification | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((notification) => activeFilter === 'all' || notification.category === activeFilter)
      .filter((notification) => matchesNotificationStatusFilters(notification, statusFilters))
      .filter((notification) => matchesNotificationSearch(notification, searchQuery))
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
  }, [activeFilter, notifications, searchQuery, statusFilters]);

  const activeFilterCount =
    Number(activeFilter !== 'all') +
    Number(statusFilters.readStatus !== 'all') +
    Number(statusFilters.priority !== 'all');

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

  const handleClearFilters = () => {
    setActiveFilter('all');
    setStatusFilters(defaultStatusFilters);
    setSearchQuery('');
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

    if (notification.data?.action === 'pay_balance' && notification.bookingId) {
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
          <NotificationHeader unreadCount={unreadCount} onMarkAllAsRead={handleMarkAllAsRead} />

          <View className="mt-6">
            <NotificationSearchBar
              activeFilterCount={activeFilterCount}
              value={searchQuery}
              onFilterPress={() => setIsFilterOpen(true)}
              onSearchChange={setSearchQuery}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-between gap-3">
            <Text className="text-[13px] font-black text-foreground">
              {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void loadNotifications()}>
              <Text className="text-[12px] font-bold text-primary">Refresh</Text>
            </Pressable>
          </View>

          <View className="mt-4 gap-5">
            {loadError ? (
              <View className="rounded-[24px] border border-destructive-border bg-destructive-surface p-4">
                <Text className="text-[13px] font-bold text-destructive">{loadError}</Text>
              </View>
            ) : null}
            {isLoading ? (
              <NotificationLoadingState />
            ) : filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpenNotification}
                />
              ))
            ) : (
              <NotificationEmptyState
                showClearFilters={Boolean(searchQuery.trim()) || activeFilterCount > 0}
                onClearFilters={handleClearFilters}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <NotificationDetailModal
        notification={selectedNotification}
        onAction={handleNotificationAction}
        onClose={() => setSelectedNotification(null)}
      />

      <NotificationFilterSheet
        categoryFilter={activeFilter}
        filters={statusFilters}
        visible={isFilterOpen}
        onApply={(categoryFilter, filters) => {
          setActiveFilter(categoryFilter);
          setStatusFilters(filters);
        }}
        onClose={() => setIsFilterOpen(false)}
      />
    </View>
  );
}
