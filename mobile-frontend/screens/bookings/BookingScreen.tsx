import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookingCard,
  BookingEmptyState,
  BookingLoadingState,
  type BookingAction,
} from '@/components/bookings';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
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
  const { width } = useWindowDimensions();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={cx(
        'min-h-12 w-full items-center justify-center rounded-field border px-0.5 py-2',
        isSelected ? 'border-primary bg-primary' : 'border-border bg-surface',
      )}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ fontSize: width < 360 ? 11 : 13 }}
        className={cx(
          'font-sans',
          'text-center font-semibold',
          isSelected ? 'text-surface' : 'text-foreground',
        )}>
        {label}
      </Text>
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
      <Pressable className="flex-1 justify-end bg-foreground/45" onPress={onClose}>
        <Pressable
          className="w-full max-w-[560px] self-center rounded-t-sheet bg-surface px-screen pt-4"
          style={{ paddingBottom: insets.bottom + 28 }}>
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-border" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-sans text-[22px] font-semibold text-foreground">Filter bookings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close booking filters"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-background">
              <X size={19} color={themeColors.foreground} strokeWidth={2.5} />
            </Pressable>
          </View>

          <Text className="font-sans mb-3 text-[13px] font-normal text-secondary-foreground">Status</Text>
          <View className="-mx-1 flex-row flex-wrap">
            {BOOKING_STATUS_FILTERS.map((status) => (
              <View key={status} className="w-1/4 p-1">
                <BookingFilterChip
                  label={status}
                  isSelected={draftStatus === status}
                  onPress={() => setDraftStatus(status)}
                />
              </View>
            ))}
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraftStatus('All')}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full border border-border bg-surface">
              <Text className="font-sans text-[15px] font-semibold text-foreground">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onApply(draftStatus);
                onClose();
              }}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full bg-primary">
              <Text className="font-sans text-[15px] font-semibold text-surface">Apply</Text>
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
      router.navigate({ pathname: '/(tabs)/telematics', params: { bookingId: booking.id } });
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
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: floatingTabBarContentPadding + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader title="Bookings" />

          <View className="mt-2 min-h-[56px] flex-row items-center rounded-full border border-border bg-surface px-4 ">
            <Search size={20} color={themeColors.subtleForeground} strokeWidth={2.3} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search booking ID or vehicle name..."
              placeholderTextColor={themeColors.subtleForeground}
              className="font-sans min-w-0 flex-1 px-3 text-[14px] font-semibold text-foreground"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                activeFilterCount > 0 ? `Open filters, ${activeFilterCount} active` : 'Open filters'
              }
              hitSlop={8}
              onPress={() => setIsFilterOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-full bg-muted">
              <SlidersHorizontal size={18} color={themeColors.primary} strokeWidth={2.5} />
              {activeFilterCount > 0 ? (
                <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
                  <Text className="font-sans text-[11px] font-semibold text-surface">
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-between gap-3">
            <Text className="font-sans text-[13px] font-semibold text-foreground">
              {filteredBookings.length} booking{filteredBookings.length === 1 ? '' : 's'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void loadBookings()}>
              <Text className="font-sans text-[12px] font-medium text-primary">Refresh</Text>
            </Pressable>
          </View>

          <View className="mt-4 gap-3">
            {loadError ? (
              <View className="rounded-[24px] border border-destructive-border bg-destructive-surface p-4">
                <Text className="font-sans text-[13px] font-medium text-destructive">{loadError}</Text>
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
