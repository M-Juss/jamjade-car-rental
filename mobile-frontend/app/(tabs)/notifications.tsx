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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  plateNumber?: string;
  paymentStatus?: string;
  tripStatus?: string;
  actionLabel?: string;
};

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

// TODO: Replace mock data with GET /api/customer/notifications.
const mockNotifications: CustomerNotification[] = [
  {
    id: 'NTF-001',
    title: 'Booking request submitted',
    message: 'Your Toyota Vios booking request is waiting for Jamjade admin review.',
    fullMessage:
      'Your booking request for the Toyota Vios has been submitted successfully. Jamjade will review your rental schedule, uploaded documents, pickup details, and down payment status before confirming the booking.',
    category: 'booking',
    priority: 'normal',
    isRead: false,
    createdAt: '2026-05-25T09:35:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    actionLabel: 'View Booking',
  },
  {
    id: 'NTF-002',
    title: 'Booking approved',
    message: 'Your Mitsubishi Xpander booking has been approved for pickup.',
    fullMessage:
      'Good news. Your Mitsubishi Xpander booking is approved. Please arrive at Jamjade Garage 30 minutes before pickup and bring your valid ID and driver license for vehicle release.',
    category: 'booking',
    priority: 'success',
    isRead: false,
    createdAt: '2026-05-25T08:50:00+08:00',
    bookingId: 'BK-2026-002',
    vehicleName: 'Mitsubishi Xpander',
    plateNumber: 'XYZ 5678',
    paymentStatus: 'Partially Paid',
    actionLabel: 'View Booking',
  },
  {
    id: 'NTF-003',
    title: 'Down payment required',
    message: 'PHP 3,000 down payment is required to continue your booking.',
    fullMessage:
      'A down payment of PHP 3,000 is required for Booking BK-2026-003. Once payment is recorded, Jamjade can continue the approval and vehicle release process.',
    category: 'payment',
    priority: 'warning',
    isRead: false,
    createdAt: '2026-05-25T08:20:00+08:00',
    bookingId: 'BK-2026-003',
    vehicleName: 'Toyota Innova',
    plateNumber: 'JMD 8899',
    paymentStatus: 'Down Payment Pending',
    actionLabel: 'Pay Down Payment',
  },
  {
    id: 'NTF-004',
    title: 'Vehicle ready for pickup',
    message: 'Your Toyota Innova is prepared and ready for release.',
    fullMessage:
      'Your Toyota Innova has passed the release checklist and is ready for pickup at Jamjade Garage. Please confirm the vehicle condition and plate number before starting your rental.',
    category: 'vehicle',
    priority: 'success',
    isRead: true,
    createdAt: '2026-05-24T18:45:00+08:00',
    bookingId: 'BK-2026-004',
    vehicleName: 'Toyota Innova',
    plateNumber: 'INN 4210',
    actionLabel: 'View Vehicle',
  },
  {
    id: 'NTF-005',
    title: 'Rental is now active',
    message: 'Your Toyota Vios rental is active. Telematics is now enabled.',
    fullMessage:
      'Your rental for the Toyota Vios is now active. Telematics features are enabled for this booking, including trip start, trip pause, GPS status, geofence alerts, and flagged event monitoring.',
    category: 'booking',
    priority: 'success',
    isRead: false,
    createdAt: '2026-05-24T15:10:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    tripStatus: 'Active Trip',
    actionLabel: 'Start Trip',
  },
  {
    id: 'NTF-006',
    title: 'Trip started',
    message: 'GPS tracking is active for your Toyota Vios trip.',
    fullMessage:
      'Your trip has started and GPS tracking is active. Jamjade will use trip telemetry to help monitor route activity, flagged driving behavior, geofence status, and vehicle return readiness.',
    category: 'trip',
    priority: 'normal',
    isRead: true,
    createdAt: '2026-05-24T15:05:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    tripStatus: 'Driving',
    actionLabel: 'View Trip',
  },
  {
    id: 'NTF-007',
    title: 'Geofence alert',
    message: 'Toyota Vios moved outside the approved service area.',
    fullMessage:
      'A geofence alert was detected for the Toyota Vios. The vehicle appears to have moved outside the approved route or service area. Please return to the allowed area or contact Jamjade support if this is expected.',
    category: 'trip',
    priority: 'urgent',
    isRead: false,
    createdAt: '2026-05-24T13:30:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    tripStatus: 'Geofence Alert',
    actionLabel: 'View Trip Alert',
  },
  {
    id: 'NTF-008',
    title: 'Flagged driving event detected',
    message: 'A harsh braking event was recorded during your active trip.',
    fullMessage:
      'Jamjade detected a flagged driving event during your active trip. The recorded behavior is harsh braking. Please drive carefully and keep the vehicle within safe operating conditions.',
    category: 'trip',
    priority: 'warning',
    isRead: false,
    createdAt: '2026-05-24T12:15:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    tripStatus: 'Flagged Event',
    actionLabel: 'View Trip Alert',
  },
  {
    id: 'NTF-009',
    title: 'Payment received',
    message: 'Your PHP 5,000 payment for BK-2026-002 has been recorded.',
    fullMessage:
      'Jamjade has recorded your PHP 5,000 payment for Booking BK-2026-002. Your payment status is now partially paid. The remaining balance can be settled before or during vehicle release.',
    category: 'payment',
    priority: 'success',
    isRead: true,
    createdAt: '2026-05-23T17:25:00+08:00',
    bookingId: 'BK-2026-002',
    vehicleName: 'Mitsubishi Xpander',
    plateNumber: 'XYZ 5678',
    paymentStatus: 'Partially Paid',
    actionLabel: 'View Payment',
  },
  {
    id: 'NTF-010',
    title: 'Toll fee update',
    message: 'A PHP 320 toll fee was added to your active rental.',
    fullMessage:
      'A toll fee of PHP 320 has been added to Booking BK-2026-001 based on your trip activity. This amount will appear in your final payment breakdown when the vehicle is returned.',
    category: 'payment',
    priority: 'normal',
    isRead: true,
    createdAt: '2026-05-23T11:40:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    paymentStatus: 'Additional Fee Added',
    actionLabel: 'View Payment',
  },
  {
    id: 'NTF-011',
    title: 'Vehicle released',
    message: 'Your Mitsubishi Xpander has been released by Jamjade staff.',
    fullMessage:
      'The Mitsubishi Xpander assigned to Booking BK-2026-002 has been released. Please keep your rental documents and return schedule visible in the app during the rental period.',
    category: 'vehicle',
    priority: 'success',
    isRead: false,
    createdAt: '2026-05-22T14:05:00+08:00',
    bookingId: 'BK-2026-002',
    vehicleName: 'Mitsubishi Xpander',
    plateNumber: 'XYZ 5678',
    actionLabel: 'View Vehicle',
  },
  {
    id: 'NTF-012',
    title: 'Return date reminder',
    message: 'Your Toyota Vios is due for return tomorrow at 9:00 AM.',
    fullMessage:
      'This is a reminder that your Toyota Vios rental is due for return tomorrow at 9:00 AM. Please return the vehicle to Jamjade Garage on time to avoid late return fees.',
    category: 'booking',
    priority: 'warning',
    isRead: false,
    createdAt: '2026-05-22T09:00:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    actionLabel: 'View Booking',
  },
  {
    id: 'NTF-013',
    title: 'Late return fee added',
    message: 'A PHP 850 late return fee has been added to BK-2026-005.',
    fullMessage:
      'A late return fee of PHP 850 has been added to Booking BK-2026-005 because the vehicle was returned after the agreed schedule. Please review the updated payment breakdown.',
    category: 'payment',
    priority: 'urgent',
    isRead: true,
    createdAt: '2026-05-21T16:30:00+08:00',
    bookingId: 'BK-2026-005',
    vehicleName: 'Toyota Innova',
    plateNumber: 'INN 4210',
    paymentStatus: 'Late Fee Added',
    actionLabel: 'View Payment',
  },
  {
    id: 'NTF-014',
    title: 'Document submission reminder',
    message: 'Please upload your valid ID and driver license before approval.',
    fullMessage:
      'Jamjade needs your required customer documents before approving your next booking. Please upload a clear valid ID, driver license, and any additional requested proof of address.',
    category: 'system',
    priority: 'warning',
    isRead: false,
    createdAt: '2026-05-21T10:20:00+08:00',
    actionLabel: 'Update Profile',
  },
  {
    id: 'NTF-015',
    title: 'Support message from Jamjade',
    message: 'Admin added a note about your pickup arrangement.',
    fullMessage:
      'Jamjade support added a note to your booking: please confirm if you prefer shop pickup or delivery for your upcoming Toyota Vios rental. Contact support if you need to change the schedule.',
    category: 'system',
    priority: 'normal',
    isRead: true,
    createdAt: '2026-05-20T19:15:00+08:00',
    bookingId: 'BK-2026-001',
    vehicleName: 'Toyota Vios',
    plateNumber: 'ABC 1234',
    actionLabel: 'Contact Support',
  },
];

const categoryConfig: Record<NotificationCategory, CategoryConfig> = {
  booking: {
    label: 'Booking',
    icon: CalendarCheck,
    iconWrapClass: 'bg-[#EEF4FF]',
    iconColor: '#346EF6',
    badgeClass: 'bg-[#EEF4FF] border-[#DDE8FF]',
    badgeTextClass: 'text-[#346EF6]',
  },
  payment: {
    label: 'Payment',
    icon: CreditCard,
    iconWrapClass: 'bg-[#ECFDF5]',
    iconColor: '#047857',
    badgeClass: 'bg-[#ECFDF5] border-[#BBF7D0]',
    badgeTextClass: 'text-[#047857]',
  },
  vehicle: {
    label: 'Vehicle',
    icon: Car,
    iconWrapClass: 'bg-[#F3F7FF]',
    iconColor: '#1F58E7',
    badgeClass: 'bg-[#F3F7FF] border-[#DDE8FF]',
    badgeTextClass: 'text-[#1F58E7]',
  },
  trip: {
    label: 'Trip',
    icon: Navigation,
    iconWrapClass: 'bg-[#FFF7ED]',
    iconColor: '#C2410C',
    badgeClass: 'bg-[#FFF7ED] border-[#FED7AA]',
    badgeTextClass: 'text-[#C2410C]',
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
    dotClass: 'bg-[#346EF6]',
    badgeClass: 'bg-[#EEF4FF] border-[#DDE8FF]',
    textClass: 'text-[#346EF6]',
    borderClass: 'border-l-[#346EF6]',
  },
  success: {
    label: 'Success',
    dotClass: 'bg-[#16A34A]',
    badgeClass: 'bg-[#ECFDF5] border-[#BBF7D0]',
    textClass: 'text-[#047857]',
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
    dotClass: 'bg-[#DC2626]',
    badgeClass: 'bg-[#FEF2F2] border-[#FECACA]',
    textClass: 'text-[#B91C1C]',
    borderClass: 'border-l-[#DC2626]',
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
    notification.plateNumber,
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

      <View className="mt-4 flex-row items-center justify-between gap-3 rounded-[24px] border border-[#DDE8FF] bg-white px-4 py-3 shadow-sm shadow-[#17315F]/5">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View className={cx('h-3 w-3 rounded-full', unreadCount > 0 ? 'bg-[#346EF6]' : 'bg-[#CBD5E1]')} />
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[0.45px] text-[#91A0B8]">Unread updates</Text>
            <Text className="mt-0.5 text-[15px] font-black text-[#17315F]" numberOfLines={1}>
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
            unreadCount > 0 ? 'bg-[#346EF6]' : 'bg-[#F1F5F9]',
          )}>
          <CheckCircle2 size={15} color={unreadCount > 0 ? '#FFFFFF' : '#94A3B8'} strokeWidth={2.5} />
          <Text className={cx('text-[12px] font-black', unreadCount > 0 ? 'text-white' : 'text-[#91A0B8]')}>
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
    <View className="min-h-[56px] flex-row items-center rounded-full border border-[#E6EEFF] bg-white px-4 shadow-md shadow-[#17315F]/5">
      <Search size={20} color="#7B879C" strokeWidth={2.3} />
      <TextInput
        value={value}
        onChangeText={onSearchChange}
        placeholder="Search notifications..."
        placeholderTextColor="#9AA4B8"
        className="min-w-0 flex-1 px-3 text-[14px] font-semibold text-[#17315F]"
      />
      {value.trim() ? (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onSearchChange('')}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#EEF4FF]">
          <X size={16} color="#346EF6" strokeWidth={2.5} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount > 0 ? `Open filters, ${activeFilterCount} active` : 'Open filters'}
        hitSlop={8}
        onPress={onFilterPress}
        className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF]">
        <SlidersHorizontal size={18} color="#346EF6" strokeWidth={2.5} />
        {activeFilterCount > 0 ? (
          <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-[#346EF6] px-1">
            <Text className="text-[10px] font-black text-white">{activeFilterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function FilterGroup({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-3 text-[13px] font-black uppercase tracking-[0.9px] text-[#91A0B8]">{title}</Text>
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
        isSelected ? 'border-[#346EF6] bg-[#346EF6]' : 'border-[#DDE8FF] bg-white',
      )}>
      <Text className={cx('text-[13px] font-black', isSelected ? 'text-white' : 'text-[#17315F]')}>{label}</Text>
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
        <Pressable className="max-h-[86%] rounded-t-[32px] bg-white px-5 pt-4" style={{ paddingBottom: insets.bottom + 28 }}>
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-[#D7DDE8]" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[22px] font-black text-[#17315F]">Filters</Text>
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
              className="min-h-[54px] flex-1 items-center justify-center rounded-full border border-[#DDE8FF] bg-white">
              <Text className="text-[15px] font-black text-[#17315F]">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onApply(draftCategory, draftFilters);
                onClose();
              }}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full bg-[#346EF6]">
              <Text className="text-[15px] font-black text-white">Apply</Text>
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
        'overflow-hidden rounded-[24px] border bg-white p-4 shadow-md shadow-[#17315F]/6',
        notification.isRead ? 'border-[#E6EEFF]' : 'border-[#BFD5FF]',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('h-11 w-11 items-center justify-center rounded-full', category.iconWrapClass)}>
          <Icon size={20} color={category.iconColor} strokeWidth={2.45} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <Text
              className={cx(
                'min-w-0 flex-1 text-[16px] leading-5 text-[#17315F]',
                notification.isRead ? 'font-extrabold' : 'font-black',
              )}
              numberOfLines={2}>
              {notification.title}
            </Text>
            {!notification.isRead ? <View className="mt-1 h-2.5 w-2.5 rounded-full bg-[#346EF6]" /> : null}
          </View>

          <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#53647F]" numberOfLines={2}>
            {notification.message}
          </Text>

          <View className="mt-3 flex-row items-center justify-between gap-3">
            <NotificationBadge className={category.badgeClass} textClassName={category.badgeTextClass}>
              {category.label}
            </NotificationBadge>
            <Text className="min-w-0 flex-1 text-right text-[12px] font-bold text-[#91A0B8]" numberOfLines={1}>
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
    <View className="flex-row items-start justify-between gap-4 border-b border-[#E6EEFF] py-3">
      <Text className="w-[112px] text-[11px] font-black uppercase text-[#91A0B8]">{label}</Text>
      <Text className="min-w-0 flex-1 text-right text-[13px] font-bold leading-5 text-[#17315F]">{value}</Text>
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

  return (
    <Modal animationType="slide" transparent visible={Boolean(notification)} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-[#081A33]/45">
        <Pressable accessibilityLabel="Close notification detail" className="absolute inset-0" onPress={onClose} />

        <View
          className="max-h-[88%] rounded-t-[34px] bg-[#F8FAFF] px-5 pt-4"
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
                className="h-10 w-10 items-center justify-center rounded-full bg-white">
                <X size={18} color="#17315F" strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text className="mt-4 text-[24px] font-black leading-[29px] text-[#17315F]">{notification.title}</Text>
            <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#53647F]">{notification.fullMessage}</Text>

            <View className="mt-4 flex-row flex-wrap items-center gap-2">
              <View className={cx('h-2.5 w-2.5 rounded-full', priority.dotClass)} />
              <NotificationBadge className={category.badgeClass} textClassName={category.badgeTextClass}>
                {category.label}
              </NotificationBadge>
              <NotificationBadge className={priority.badgeClass} textClassName={priority.textClass}>
                {priority.label}
              </NotificationBadge>
              <NotificationBadge className="border-[#E6EEFF] bg-white" textClassName="text-[#6C7A96]">
                {notification.isRead ? 'Read' : 'Unread'}
              </NotificationBadge>
            </View>

            <View className="mt-5 rounded-[26px] border border-[#E6EEFF] bg-white px-4">
              <NotificationDetailRow label="Date" value={formatDateTime(notification.createdAt)} />
              <NotificationDetailRow label="Booking ID" value={notification.bookingId} />
              <NotificationDetailRow label="Vehicle" value={notification.vehicleName} />
              <NotificationDetailRow label="Plate No." value={notification.plateNumber} />
              <NotificationDetailRow label="Payment" value={notification.paymentStatus} />
              <NotificationDetailRow label="Trip Status" value={notification.tripStatus} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => onAction(notification)}
              className="mt-5 min-h-[54px] flex-row items-center justify-center gap-2 rounded-full bg-[#065F46] px-4">
              <Info size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-[14px] font-black text-white" numberOfLines={1}>
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
    <View className="items-center rounded-[32px] border border-dashed border-[#C8D4E8] bg-white p-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#EEF4FF]">
        <Bell size={30} color="#346EF6" strokeWidth={2.25} />
      </View>
      <Text className="mt-4 text-center text-[20px] font-black text-[#17315F]">No notifications found</Text>
      <Text className="mt-2 text-center text-[14px] font-semibold leading-5 text-[#6C7A96]">
        You are all caught up. New updates will appear here.
      </Text>
      {showClearFilters ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearFilters}
          className="mt-6 min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-[#065F46] px-6">
          <X size={17} color="#FFFFFF" strokeWidth={2.45} />
          <Text className="text-[15px] font-black text-white">Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationSkeletonCard() {
  return (
    <View className="overflow-hidden rounded-[28px] border border-[#E6EEFF] bg-white p-4">
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
      <Text className="text-[13px] font-bold text-[#6C7A96]">Loading your notifications...</Text>
      {[1, 2, 3, 4].map((item) => (
        <NotificationSkeletonCard key={item} />
      ))}
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const [notifications, setNotifications] = useState<CustomerNotification[]>(mockNotifications);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [statusFilters, setStatusFilters] = useState<NotificationStatusFilters>(defaultStatusFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<CustomerNotification | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isLoading = false;

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
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

  const handleMarkAllAsRead = () => {
    // TODO: Connect mark all as read to PATCH /api/customer/notifications/read-all.
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, isRead: true })),
    );
    setSelectedNotification((currentNotification) =>
      currentNotification ? { ...currentNotification, isRead: true } : currentNotification,
    );
  };

  const handleOpenNotification = (notification: CustomerNotification) => {
    if (!notification.isRead) {
      const readNotification = { ...notification, isRead: true };
      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id ? readNotification : currentNotification,
        ),
      );
      setSelectedNotification(readNotification);
      return;
    }

    setSelectedNotification(notification);
  };

  const handleClearFilters = () => {
    setActiveFilter('all');
    setStatusFilters(defaultStatusFilters);
    setSearchQuery('');
  };

  const handleNotificationAction = (notification: CustomerNotification) => {
    console.log('Navigate based on notification type:', notification);
    // TODO: Connect action button to proper navigation route.
    // Booking notification should navigate to Booking Details.
    // Payment notification should navigate to Payment / Booking Details.
    // Vehicle notification should navigate to Vehicle Details.
    // Trip notification should navigate to Telematics.
    // System notification should navigate to Profile or Support.
  };

  return (
    <View className="flex-1 bg-[#F8FAFF]">
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
            <Text className="text-[13px] font-black text-[#17315F]">
              {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
            </Text>
            <Text className="text-[12px] font-bold text-[#91A0B8]">Mock data only</Text>
          </View>

          <View className="mt-4 gap-5">
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
