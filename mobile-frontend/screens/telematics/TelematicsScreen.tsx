import { useEffect } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { TelematicsRentalsScreen } from './TelematicsRentalsScreen';

export function TelematicsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  useEffect(() => {
    if (!bookingId) return;
    router.setParams({ bookingId: '' });
    router.push(`/telematics/${encodeURIComponent(bookingId)}` as Href);
  }, [bookingId, router]);
  return <TelematicsRentalsScreen />;
}
