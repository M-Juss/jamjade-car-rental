import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookingCard,
  BookingEmptyState,
  BookingLoadingState,
  type BookingAction,
} from '@/components/bookings';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { matchesBookingSearch, matchesBookingStatus } from '@/lib/bookings/helpers';
import { cancelBooking, getBookings } from '@/services/api';
import { BOOKING_STATUS_FILTERS, type Booking, type BookingStatusFilter } from '@/types/booking';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function BookingFilterChip({
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
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={cx(
        'rounded-full border px-4 py-2.5',
        isSelected ? 'border-[#346EF6] bg-[#346EF6]' : 'border-[#DDE8FF] bg-white',
      )}>
      <Text className={cx('text-[13px] font-black', isSelected ? 'text-white' : 'text-[#17315F]')}>{label}</Text>
    </Pressable>
  );
}

function BookingFilterSheet({
  onApply,
  onClose,
  selectedStatus,
  visible,
}: {
  visible: boolean;
  selectedStatus: BookingStatusFilter;
  onApply: (status: BookingStatusFilter) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draftStatus, setDraftStatus] = useState<BookingStatusFilter>(selectedStatus);

  useEffect(() => {
    if (visible) {
      setDraftStatus(selectedStatus);
    }
  }, [selectedStatus, visible]);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-[#0B1220]/45" onPress={onClose}>
        <Pressable className="rounded-t-[32px] bg-white px-5 pt-4" style={{ paddingBottom: insets.bottom + 28 }}>
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-[#D7DDE8]" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[22px] font-black text-[#17315F]">Filter bookings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close booking filters"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F6FB]">
              <X size={19} color="#17315F" strokeWidth={2.5} />
            </Pressable>
          </View>

          <Text className="mb-3 text-[13px] font-black uppercase tracking-[0.9px] text-[#91A0B8]">Status</Text>
          <View className="flex-row flex-wrap gap-2">
            {BOOKING_STATUS_FILTERS.map((status) => (
              <BookingFilterChip
                key={status}
                label={status}
                isSelected={draftStatus === status}
                onPress={() => setDraftStatus(status)}
              />
            ))}
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraftStatus('All')}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full border border-[#DDE8FF] bg-white">
              <Text className="text-[15px] font-black text-[#17315F]">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onApply(draftStatus);
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

export function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const [selectedStatus, setSelectedStatus] = useState<BookingStatusFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeFilterCount = Number(selectedStatus !== 'All');

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      setBookings(await getBookings());
    } catch {
      setLoadError('Bookings could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBookings();
    }, [loadBookings]),
  );

  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (booking) => matchesBookingStatus(booking, selectedStatus) && matchesBookingSearch(booking, searchTerm),
    );
  }, [bookings, searchTerm, selectedStatus]);

  const handleAction = (action: BookingAction, booking: Booking) => {
    if (action.key === 'pay_balance' || action.key === 'payment_info') {
      router.push(`/bookings/payment?bookingId=${encodeURIComponent(booking.id)}` as Href);
      return;
    }

    if (action.key === 'cancel_request') {
      Alert.alert(
        'Cancel booking?',
        'Captured payments are subject to the booking terms and are not automatically refunded.',
        [
          { text: 'Keep Booking', style: 'cancel' },
          {
            text: 'Cancel Booking',
            style: 'destructive',
            onPress: () => void cancelBooking(booking.id).then(loadBookings),
          },
        ],
      );
      return;
    }

    if (action.key === 'open_telematics') {
      router.push('/telematics' as Href);
      return;
    }

    if (action.key === 'book_another_vehicle' || action.key === 'book_again') {
      router.push('/' as Href);
      return;
    }
  };

  const emptyTitle = searchTerm.trim()
    ? 'No Matching Bookings'
    : selectedStatus === 'All'
      ? 'No Bookings Yet'
      : `No ${selectedStatus} Bookings`;

  const emptySubtitle = searchTerm.trim()
    ? 'Try another booking ID or vehicle name.'
    : selectedStatus === 'All'
      ? 'Start browsing available vehicles and create your first booking.'
      : `You do not have any ${selectedStatus.toLowerCase()} bookings right now. Start browsing available vehicles and create a new booking.`;

  return (
    <View className="flex-1 bg-[#F8FAFF]">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader description="Track every rental from request to return." />

          <View className="mt-6 min-h-[56px] flex-row items-center rounded-full border border-[#E6EEFF] bg-white px-4 shadow-md shadow-[#17315F]/5">
            <Search size={20} color="#7B879C" strokeWidth={2.3} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search booking ID or vehicle name..."
              placeholderTextColor="#9AA4B8"
              className="min-w-0 flex-1 px-3 text-[14px] font-semibold text-[#17315F]"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount > 0 ? `Open filters, ${activeFilterCount} active` : 'Open filters'}
              hitSlop={8}
              onPress={() => setIsFilterOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF]">
              <SlidersHorizontal size={18} color="#346EF6" strokeWidth={2.5} />
              {activeFilterCount > 0 ? (
                <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-[#346EF6] px-1">
                  <Text className="text-[10px] font-black text-white">{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-between gap-3">
            <Text className="text-[13px] font-black text-[#17315F]">
              {filteredBookings.length} booking{filteredBookings.length === 1 ? '' : 's'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void loadBookings()}>
              <Text className="text-[12px] font-bold text-[#346EF6]">Refresh</Text>
            </Pressable>
          </View>

          <View className="mt-4 gap-5">
            {loadError ? (
              <View className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-4">
                <Text className="text-[13px] font-bold text-[#B91C1C]">{loadError}</Text>
              </View>
            ) : null}
            {isLoading ? (
              <BookingLoadingState />
            ) : filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onAction={handleAction}
                  onViewDetails={(selectedBooking) => router.push(`/bookings/${selectedBooking.id}` as Href)}
                />
              ))
            ) : (
              <BookingEmptyState
                title={emptyTitle}
                subtitle={emptySubtitle}
                onBrowsePress={() => router.push('/' as Href)}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BookingFilterSheet
        visible={isFilterOpen}
        selectedStatus={selectedStatus}
        onApply={setSelectedStatus}
        onClose={() => setIsFilterOpen(false)}
      />
    </View>
  );
}
