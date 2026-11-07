import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { getBookingDeliveryEstimate, type DeliveryEstimate } from '@/services/api/delivery.service';
import { formatPeso } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';
import { DeliveryPointMap } from './DeliveryPointMap';
import { DeliveryLocationLink } from './DeliveryLocationLink';
import { MetadataList } from '@/components/common/MetadataList';

export function DeliveryLocationDetails({ booking }: { booking: Booking }) {
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const latestLoad = useRef(0);
  const point = booking.deliveryLocation?.point;
  const hasPoint = Boolean(point);
  const loadEstimate = useCallback(async () => {
    const request = ++latestLoad.current;
    setEstimate(null);
    setFailed(false);
    setLoading(hasPoint);
    if (!hasPoint) return;
    try {
      const result = await getBookingDeliveryEstimate(booking.id);
      if (request === latestLoad.current) setEstimate(result);
    } catch {
      if (request === latestLoad.current) setFailed(true);
    } finally {
      if (request === latestLoad.current) setLoading(false);
    }
  }, [booking.id, hasPoint]);
  useFocusEffect(useCallback(() => {
    void loadEstimate();
    return () => { latestLoad.current += 1; };
  }, [loadEstimate]));

  if (!booking.deliveryLocation) return null;
  return <View className="mt-3 gap-3">
    {point && <DeliveryPointMap point={point} />}
    {booking.notes ? <View className="gap-1">
      <Text className="font-sans text-caption text-secondary-foreground">Note</Text>
      <Text className="font-sans text-body text-foreground">{booking.notes}</Text>
    </View> : null}
    {estimate ? <MetadataList items={[
      { label: 'Estimated distance', value: `${(estimate.distanceMeters / 1000).toFixed(2)} km` },
      { label: 'Estimated time', value: `${Math.ceil(estimate.durationSeconds / 60)} min` },
    ]} /> : loading ? <Text className="font-sans text-caption text-secondary-foreground">Loading distance and time...</Text> : failed ? (
      <Pressable accessibilityRole="button" className="min-h-control justify-center" onPress={() => void loadEstimate()}>
        <Text className="font-sans text-caption text-primary">Distance and time unavailable. Retry</Text>
      </Pressable>
    ) : null}
    <View className="flex-row flex-wrap justify-between gap-2 border-t border-border pt-3">
      <Text className="font-sans text-body text-foreground">Agreed delivery fee</Text>
      <Text className="font-sans text-body font-semibold text-foreground">{formatPeso(booking.deliveryFee)}</Text>
    </View>
    <DeliveryLocationLink location={booking.deliveryLocation} />
  </View>;
}
