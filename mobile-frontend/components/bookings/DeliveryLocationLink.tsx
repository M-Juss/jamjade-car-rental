import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { ActionButton } from './ActionButton';
import type { Booking } from '@/types/booking';
export function DeliveryLocationLink({
  location,
  navigate = false,
}: {
  location: NonNullable<Booking['deliveryLocation']>;
  navigate?: boolean;
}) {
  const [error, setError] = useState(false);
  const open = async () => {
    const params = new URLSearchParams({
      api: '1',
      [navigate ? 'destination' : 'query']: location.point
        ? `${location.point.latitude},${location.point.longitude}`
        : location.address,
    });
    if (location.placeId && !location.point)
      params.set(navigate ? 'destination_place_id' : 'query_place_id', location.placeId);
    if (navigate) {
      params.set('travelmode', 'driving');
      params.set('dir_action', 'navigate');
    }
    try {
      await Linking.openURL(`https://www.google.com/maps/${navigate ? 'dir' : 'search'}/?${params}`);
      setError(false);
    } catch {
      setError(true);
    }
  };
  return (
    <View className="mt-3 gap-2">
      <ActionButton
        icon={MapPin}
        label={navigate ? 'Navigate in Google Maps' : 'View Delivery Point'}
        variant="secondary"
        onPress={() => void open()}
      />
      {!location.point && (
        <Text className="font-sans text-caption text-secondary-foreground">
          The saved map point expired. Reconfirm the delivery point using the
          address before the trip.
        </Text>
      )}
      {error && (
        <Text
          accessibilityRole="alert"
          className="font-sans text-caption text-destructive"
        >
          Google Maps could not open. Try again.
        </Text>
      )}
    </View>
  );
}
