import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ErrorState, VehicleDetailsDrawer, VehicleStoryCarousel } from '@/components/browse';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import { toggleBookmarkedVehicle, useBookmarkedVehicleIds } from '@/lib/browse/bookmarks';

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const resolvedVehicleId = firstParam(vehicleId);
  const { vehicle, isLoading, error, reload } = useVehicle(resolvedVehicleId);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FAFF]">
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

  return (
    <View className="flex-1 bg-white">
      <VehicleStoryCarousel
        vehicle={vehicle}
        activeIndex={activeImageIndex}
        isBookmarked={bookmarkedVehicleIds.includes(vehicle.id)}
        onActiveIndexChange={setActiveImageIndex}
        onBookmarkPress={() => toggleBookmarkedVehicle(vehicle.id)}
        onBackPress={() => router.back()}
      />
      <VehicleDetailsDrawer
        vehicle={vehicle}
        onBookNow={() => router.push(`/browse/booking?vehicleId=${vehicle.id}` as Href)}
      />
    </View>
  );
}
