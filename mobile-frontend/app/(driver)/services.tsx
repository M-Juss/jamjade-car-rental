import { DeliveryLocationLink } from '@/components/bookings/DeliveryLocationLink';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { CreditCard, MapPin } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { getDriverServices } from '@/services/api';
import type { Booking } from '@/types/booking';

type ServiceFilter = 'Upcoming' | 'Active' | 'History';

function serviceStage(booking: Booking) {
  if (booking.status === 'Completed' || booking.status === 'Returned' || booking.status === 'Cancelled')
    return 'Finished';
  if (booking.rentalProgress.tripEnded) return 'Trip Ended · Awaiting Incoming Inspection';
  if (booking.status === 'Ongoing' || booking.status === 'Active') return 'Active Service';
  if (booking.telematicsSetupStatus === 'ready_for_release') return 'Ready · Waiting for Jamjade';
  return 'Assigned · Awaiting Outgoing Inspection';
}

export default function DriverServicesScreen() {
  const insets = useSafeAreaInsets();
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

  useFocusEffect(
    useCallback(() => {
      void loadServices();
    }, [loadServices]),
  );

  const visible = useMemo(
    () =>
      services.filter((booking) => {
        if (filter === 'Active') return booking.status === 'Ongoing' || booking.status === 'Active';
        if (filter === 'History')
          return ['Returned', 'Completed', 'Cancelled', 'Rejected'].includes(booking.status);
        return booking.status === 'Confirmed' || booking.status === 'Pending';
      }),
    [filter, services],
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: insets.bottom + floatingTabBarContentPadding, paddingTop: insets.top + 12 }}>
          <CustomerTabHeader title="Services" />

          <View className="mt-2 flex-row gap-2">
            {(['Upcoming', 'Active', 'History'] as ServiceFilter[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                className={`min-h-[42px] flex-1 items-center justify-center rounded-full border ${filter === item ? 'border-primary bg-primary' : 'border-border bg-surface'}`}>
                <Text
                  className={`font-sans text-[12px] font-semibold ${filter === item ? 'text-surface' : 'text-foreground'}`}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {message ? (
            <Text className="font-sans mt-4 rounded-[18px] border border-border bg-surface p-3 text-[12px] font-medium leading-5 text-foreground">
              {message}
            </Text>
          ) : null}
          {isLoading ? <ActivityIndicator className="mt-10" color={themeColors.primary} /> : null}

          <View className="mt-5 gap-4">
            {visible.map((booking) => {
              const driverBalance = booking.additionalCharges
                .filter((charge) => charge.paymentStatus !== 'paid')
                .reduce((sum, charge) => sum + charge.amount, 0);

              return (
                <View key={booking.id} className="rounded-card border border-border bg-surface p-5">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans text-[11px] font-semibold text-primary">{booking.id}</Text>
                      <Text className="font-sans mt-1 text-[19px] font-semibold text-foreground">
                        {booking.vehicleName}
                      </Text>
                      <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                        {booking.rentalDate} → {booking.returnDate}
                      </Text>
                      {booking.customer?.name ? (
                        <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                          Customer: {booking.customer.name}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="font-sans rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-primary">
                      {booking.status}
                    </Text>
                  </View>
                  <View className="mt-4 flex-row items-start gap-2 rounded-[18px] bg-background p-3">
                    <MapPin color={themeColors.primary} size={17} />
                    <Text className="font-sans min-w-0 flex-1 text-[12px] font-medium leading-5 text-foreground">
                      {booking.pickupLocation}
                    </Text>
                  </View>
                  {booking.deliveryLocation && <DeliveryLocationLink location={booking.deliveryLocation} />}
                  <Text className="font-sans mt-4 text-[12px] font-semibold text-foreground">
                    {serviceStage(booking)}
                  </Text>

                  {driverBalance > 0 ? (
                    <Pressable
                      onPress={() =>
                        router.push(`/driver-payment?bookingId=${encodeURIComponent(booking.id)}` as Href)
                      }
                      className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-full border border-primary bg-surface">
                      <CreditCard color={themeColors.primary} size={18} />
                      <Text className="font-sans text-[13px] font-semibold text-primary">
                        Review & Pay Driver Charges
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {!isLoading && visible.length === 0 ? (
              <Text className="font-sans py-10 text-center text-[13px] font-medium text-secondary-foreground">
                No {filter.toLowerCase()} services.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
