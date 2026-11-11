import { useLocalSearchParams } from 'expo-router';
import { BookingDetailsScreen } from '@/screens/bookings/BookingDetailsScreen';

export default function DriverServiceDetailsRoute() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <BookingDetailsScreen bookingId={bookingId} />;
}
