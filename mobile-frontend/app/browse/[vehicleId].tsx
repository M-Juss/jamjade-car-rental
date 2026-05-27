import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ErrorState, VehicleDetailsDrawer, VehicleStoryCarousel } from '@/components/browse';
import { firstParam } from '@/lib/browse/booking-params';
import { toggleBookmarkedVehicle, useBookmarkedVehicleIds } from '@/lib/browse/bookmarks';
import { getVehicleById } from '@/lib/browse/pricing';

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = getVehicleById(firstParam(vehicleId));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();

  if (!vehicle) {
    return <ErrorState onAction={() => router.replace('/')} />;
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
