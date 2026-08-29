import { useFocusEffect } from '@react-navigation/native';
import { CreditCard, Gauge, MapPin, Play, Square } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import {
  endTelematicsTrip,
  getDriverServices,
  recordBookingCalibration,
  startTelematicsTrip,
} from '@/services/api';
import type { Booking } from '@/types/booking';

type ServiceFilter = 'Upcoming' | 'Active' | 'History';

function serviceStage(booking: Booking) {
  if (booking.status === 'Completed' || booking.status === 'Returned' || booking.status === 'Cancelled') return 'Finished';
  if (booking.rentalProgress.tripEnded) return 'Trip Ended · Awaiting Incoming Inspection';
  if (booking.status === 'Ongoing' || booking.status === 'Active') return 'Active Service';
  if (booking.calibrationStatus === 'passed') return 'Ready · Waiting for Jamjade';
  if (booking.rentalProgress.outgoingFinalized) return 'Calibration Available';
  return 'Assigned · Awaiting Outgoing Inspection';
}

export default function DriverServicesScreen() {
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const router = useRouter();
  const [services, setServices] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<ServiceFilter>('Upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    try {
      setServices(await getDriverServices());
      setMessage(null);
    } catch {
      setMessage('Assigned services could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadServices(); }, [loadServices]));

  const visible = useMemo(() => services.filter((booking) => {
    if (filter === 'Active') return booking.status === 'Ongoing' || booking.status === 'Active';
    if (filter === 'History') return ['Returned', 'Completed', 'Cancelled', 'Rejected'].includes(booking.status);
    return booking.status === 'Confirmed' || booking.status === 'Pending';
  }), [filter, services]);

  const calibrate = async (booking: Booking) => {
    try {
      await recordBookingCalibration(booking.id);
      setMessage('Calibration complete. Waiting for Jamjade to start the rental.');
      await loadServices();
    } catch {
      setMessage('Calibration is not available until Outgoing Inspection is finalized.');
    }
  };

  const toggleTrip = async (booking: Booking) => {
    try {
      if (booking.rentalProgress.latestTripId && booking.rentalProgress.latestTripStatus !== 'ended') {
        await endTelematicsTrip(booking.rentalProgress.latestTripId);
        setMessage('Trip ended. Booking remains ongoing until Jamjade completes the return inspection.');
      } else {
        await startTelematicsTrip(booking.backendId);
        setMessage('Driving session started.');
      }
      await loadServices();
    } catch {
      setMessage('The trip action could not be completed. Check the current service state.');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: insets.bottom + 110, paddingTop: insets.top + 12 }}>
          <CustomerTabHeader description="Your assigned Jamjade rentals." />

          <View className="mt-5 flex-row gap-2">
            {(['Upcoming', 'Active', 'History'] as ServiceFilter[]).map((item) => (
              <Pressable key={item} onPress={() => setFilter(item)} className={`min-h-[42px] flex-1 items-center justify-center rounded-full border ${filter === item ? 'border-primary bg-primary' : 'border-border bg-surface'}`}>
                <Text className={`text-[12px] font-black ${filter === item ? 'text-surface' : 'text-foreground'}`}>{item}</Text>
              </Pressable>
            ))}
          </View>

          {message ? <Text className="mt-4 rounded-[18px] border border-border bg-surface p-3 text-[12px] font-bold leading-5 text-foreground">{message}</Text> : null}
          {isLoading ? <ActivityIndicator className="mt-10" color="#346EF6" /> : null}

          <View className="mt-5 gap-4">
            {visible.map((booking) => {
              const canCalibrate = booking.calibrationStatus === 'available';
              const isActiveTrip = booking.rentalProgress.latestTripStatus === 'started' || booking.rentalProgress.latestTripStatus === 'paused';
              const driverBalance = booking.additionalCharges.filter((charge) => charge.paymentStatus !== 'paid').reduce((sum, charge) => sum + charge.amount, 0);

              return (
                <View key={booking.id} className="rounded-[28px] border border-border bg-surface p-5">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="text-[11px] font-black uppercase text-primary">{booking.id}</Text>
                      <Text className="mt-1 text-[19px] font-black text-foreground">{booking.vehicleName}</Text>
                      <Text className="mt-1 text-[12px] font-bold text-muted-foreground">{booking.rentalDate} → {booking.returnDate}</Text>
                      {booking.customer?.name ? <Text className="mt-1 text-[12px] font-bold text-muted-foreground">Customer: {booking.customer.name}</Text> : null}
                    </View>
                    <Text className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-black text-primary">{booking.status}</Text>
                  </View>
                  <View className="mt-4 flex-row items-start gap-2 rounded-[18px] bg-background p-3">
                    <MapPin color="#346EF6" size={17} />
                    <Text className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-foreground">{booking.pickupLocation}</Text>
                  </View>
                  <Text className="mt-4 text-[12px] font-black text-foreground">{serviceStage(booking)}</Text>

                  {canCalibrate ? (
                    <Pressable onPress={() => void calibrate(booking)} className="mt-4 min-h-[48px] flex-row items-center justify-center gap-2 rounded-full bg-primary">
                      <Gauge color="#FFFFFF" size={18} /><Text className="text-[13px] font-black text-surface">Run Calibration</Text>
                    </Pressable>
                  ) : null}
                  {(booking.status === 'Ongoing' || booking.status === 'Active') && !booking.rentalProgress.tripEnded ? (
                    <Pressable onPress={() => void toggleTrip(booking)} className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-full bg-success">
                      {isActiveTrip ? <Square color="#FFFFFF" size={17} /> : <Play color="#FFFFFF" size={17} />}
                      <Text className="text-[13px] font-black text-surface">{isActiveTrip ? 'End Trip' : 'Start Trip'}</Text>
                    </Pressable>
                  ) : null}
                  {driverBalance > 0 ? (
                    <Pressable onPress={() => router.push(`/driver-payment?bookingId=${encodeURIComponent(booking.id)}` as Href)} className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-full border border-primary bg-surface">
                      <CreditCard color="#346EF6" size={18} /><Text className="text-[13px] font-black text-primary">Review & Pay Driver Charges</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {!isLoading && visible.length === 0 ? <Text className="py-10 text-center text-[13px] font-bold text-muted-foreground">No {filter.toLowerCase()} services.</Text> : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
