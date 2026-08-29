import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  BookingAccountModal,
  ErrorState,
  VehicleDetailsDrawer,
  VehicleStoryCarousel,
} from '@/components/browse';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import { toggleBookmarkedVehicle, useBookmarkedVehicleIds } from '@/lib/browse/bookmarks';
import {
  getBookingAvailability,
  useCustomer,
} from '@/lib/customer/customer-store';
import { useAuth } from '@/providers/AuthProvider';

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const resolvedVehicleId = firstParam(vehicleId);
  const { vehicle, isLoading, error, reload } = useVehicle(resolvedVehicleId);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();
  const { status } = useAuth();
  const customer = useCustomer();
  const bookingAvailability = getBookingAvailability(customer);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <ErrorState
        actionLabel={error ? 'Try Again' : 'Back to Browse'}
        subtitle={error ?? 'The selected vehicle could not be found.'}
        onAction={() => error ? void reload() : router.replace('/')}
      />
    );
  }

  const handleBookNow = () => {
    if (status === 'authenticated') {
      if (!bookingAvailability.canBook) {
        if (bookingAvailability.reason === 'balance') {
          return;
        }

        router.push(
          bookingAvailability.reason === 'profile'
            ? '/onboarding/basic-info'
            : '/onboarding/age-restriction',
        );
        return;
      }

      router.push(`/browse/booking?vehicleId=${vehicle.id}` as Href);
      return;
    }

    setIsAccountModalOpen(true);
  };

  const continueToAccount = () => {
    setIsAccountModalOpen(false);
    router.push('/login' as Href);
  };

  return (
    <View className="flex-1 bg-surface">
      <VehicleStoryCarousel
        vehicle={vehicle}
        activeIndex={activeImageIndex}
        isBookmarked={bookmarkedVehicleIds.includes(vehicle.id)}
        onActiveIndexChange={setActiveImageIndex}
        onBookmarkPress={() => toggleBookmarkedVehicle(vehicle.id)}
        onBackPress={() => router.back()}
      />
      <VehicleDetailsDrawer
        bookNowDisabled={status === 'authenticated' && bookingAvailability.reason === 'balance'}
        bookNowInfo={bookingAvailability.reason === 'balance' ? bookingAvailability.message : undefined}
        vehicle={vehicle}
        onBookNow={handleBookNow}
      />
      <BookingAccountModal
        vehicleName={vehicle.name}
        visible={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onContinueToAccount={continueToAccount}
      />
    </View>
  );
}
