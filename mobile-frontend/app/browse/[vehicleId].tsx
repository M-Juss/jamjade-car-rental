import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import {
  BookingAccountModal,
  ErrorState,
  VehicleDetailsContent,
} from '@/components/browse';
import { themeColors } from '@/constants/theme';
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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();
  const { status, refreshProfile } = useAuth();
  const [availabilityState, setAvailabilityState] = useState<'checking' | 'ready' | 'error'>('checking');
  const requestId = useRef(0);
  const customer = useCustomer();
  const bookingAvailability = getBookingAvailability(customer);

  const checkAvailability = useCallback(async () => {
    if (status !== 'authenticated') return;
    const currentRequest = ++requestId.current;
    setAvailabilityState('checking');
    try {
      await refreshProfile();
      if (currentRequest === requestId.current) setAvailabilityState('ready');
    } catch {
      if (currentRequest === requestId.current) setAvailabilityState('error');
    }
  }, [refreshProfile, status]);

  useFocusEffect(useCallback(() => {
    void checkAvailability();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkAvailability();
    });
    return () => {
      requestId.current += 1;
      subscription.remove();
    };
  }, [checkAvailability]));

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
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
        if (bookingAvailability.reason === 'balance' || bookingAvailability.reason === 'active_booking') {
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
    <View className="flex-1 bg-background">
      <VehicleDetailsContent
        key={vehicle.id}
        vehicle={vehicle}
        isBookmarked={bookmarkedVehicleIds.includes(vehicle.id)}
        onBookmarkPress={() => toggleBookmarkedVehicle(vehicle.id)}
        onBackPress={() => router.back()}
        bookNowDisabled={status === 'authenticated' && (availabilityState !== 'ready' || ['balance', 'active_booking'].includes(bookingAvailability.reason ?? ''))}
        bookNowInfo={status === 'authenticated' && availabilityState === 'checking' ? 'Checking booking availability…' : status === 'authenticated' && availabilityState === 'error' ? 'Unable to check booking availability.' : ['balance', 'active_booking'].includes(bookingAvailability.reason ?? '') ? bookingAvailability.message : undefined}
        onRetryAvailability={status === 'authenticated' && availabilityState === 'error' ? () => void checkAvailability() : undefined}
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
