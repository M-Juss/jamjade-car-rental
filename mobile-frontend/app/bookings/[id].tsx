import { useLocalSearchParams } from 'expo-router';

import { BookingDetailsScreen } from '@/screens/bookings/BookingDetailsScreen';

const firstParam = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export default function BookingDetailsRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  return <BookingDetailsScreen bookingId={firstParam(id)} />;
}
