import { useRouter, type Href } from 'expo-router';
import { ClipboardList, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookingCard,
  BookingEmptyState,
  BookingLoadingState,
  BookingStatusTabs,
  BookingSummaryCards,
  type BookingAction,
} from '@/components/bookings';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { matchesBookingSearch, matchesBookingStatus } from '@/lib/bookings/helpers';
import { bookings } from '@/lib/bookings/mock-data';
import type { BookingStatusFilter } from '@/types/booking';

export function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const [selectedStatus, setSelectedStatus] = useState<BookingStatusFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const isLoading = false;

  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (booking) => matchesBookingStatus(booking, selectedStatus) && matchesBookingSearch(booking, searchTerm),
    );
  }, [searchTerm, selectedStatus]);

  const handleAction = (action: BookingAction) => {
    if (action.key === 'open_telematics') {
      router.push('/telematics' as Href);
      return;
    }

    if (action.key === 'book_another_vehicle' || action.key === 'book_again') {
      router.push('/' as Href);
      return;
    }

    console.log(`Booking action tapped: ${action.key}`);
  };

  const emptyTitle = searchTerm.trim()
    ? 'No Matching Bookings'
    : selectedStatus === 'All'
      ? 'No Bookings Yet'
      : `No ${selectedStatus} Bookings`;

  const emptySubtitle = searchTerm.trim()
    ? 'Try another booking ID, vehicle name, or plate number.'
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
          <View className="flex-row items-center justify-between gap-4">
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5]">
                  <ClipboardList size={21} color="#065F46" strokeWidth={2.45} />
                </View>
                <Text className="min-w-0 flex-1 text-[30px] font-black leading-[34px] text-[#17315F]" numberOfLines={1}>
                  My Bookings
                </Text>
              </View>
              <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]" numberOfLines={2}>
                Track and manage your car rental bookings
              </Text>
            </View>
          </View>

          <View className="mt-6">
            <BookingSummaryCards bookings={bookings} />
          </View>

          <View className="mt-6 min-h-[56px] flex-row items-center rounded-full border border-[#E6EEFF] bg-white px-4 shadow-md shadow-[#17315F]/5">
            <Search size={20} color="#7B879C" strokeWidth={2.3} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search booking ID, vehicle, or plate number..."
              placeholderTextColor="#9AA4B8"
              className="min-w-0 flex-1 px-3 text-[14px] font-semibold text-[#17315F]"
            />
          </View>

          <View className="mt-5">
            <BookingStatusTabs selectedStatus={selectedStatus} onStatusChange={setSelectedStatus} />
          </View>

          <View className="mt-5 flex-row items-center justify-between gap-3">
            <Text className="text-[13px] font-black text-[#17315F]">
              {filteredBookings.length} booking{filteredBookings.length === 1 ? '' : 's'}
            </Text>
            <Text className="text-[12px] font-bold text-[#91A0B8]">Mock data only</Text>
          </View>

          <View className="mt-4 gap-5">
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
    </View>
  );
}
