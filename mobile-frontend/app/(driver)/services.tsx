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

function activeServiceStage(booking: Booking) {
  if (booking.rentalProgress.tripEnded) return 'Awaiting incoming inspection after trip end';
  return 'Active Service';
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
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: insets.bottom + floatingTabBarContentPadding, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader title="Services" showLogout={false} />

          <View className="mt-2 flex-row gap-2">
            {(['Upcoming', 'Active', 'History'] as ServiceFilter[]).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === item }}
                onPress={() => setFilter(item)}
                className={`min-h-control min-w-0 flex-1 items-center justify-center rounded-field border px-2 py-2 ${filter === item ? 'border-primary bg-primary' : 'border-border bg-surface'}`}>
                <Text
                  className={`font-sans text-center text-caption font-medium ${filter === item ? 'text-surface' : 'text-foreground'}`}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {message ? (
            <Text className="font-sans mt-4 rounded-card border border-border bg-surface p-3 text-[12px] font-medium leading-5 text-foreground">
              {message}
            </Text>
          ) : null}
          {isLoading ? <ActivityIndicator className="mt-10" color={themeColors.primary} /> : null}

          <View className="mt-section gap-4">
            {visible.map((booking) => {
              const isCompactCard = filter !== 'Active';
              const fullVehicleName = [booking.brand, booking.vehicleName, booking.model]
                .filter(Boolean)
                .reduce((name, part) => {
                  if (name.toLowerCase().includes(part.toLowerCase())) return name;
                  if (part.toLowerCase().includes(name.toLowerCase())) return part;
                  return `${name} ${part}`;
                }, '');
              const driverBalance = booking.additionalCharges
                .filter((charge) => charge.paymentStatus !== 'paid')
                .reduce((sum, charge) => sum + charge.amount, 0);

              return (
                <View key={booking.id} className="rounded-card border border-border bg-surface p-card">
                  <View className={isCompactCard ? 'w-full' : 'flex-row items-start justify-between gap-3'}>
                    <View className={isCompactCard ? 'min-w-0 w-full' : 'min-w-0 flex-1'}>
                      <View className={isCompactCard ? 'flex-row flex-wrap items-center justify-between gap-2' : undefined}>
                        <Text className="font-sans shrink text-caption font-semibold text-primary">{booking.id}</Text>
                        {isCompactCard ? (
                          <Text className="font-sans rounded-field bg-muted px-2 py-1 text-caption font-medium text-primary">
                            {booking.status}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        className="font-sans mt-1 text-section font-semibold text-foreground">
                        {isCompactCard
                          ? [fullVehicleName, booking.vehiclePlateNumber].filter(Boolean).join(' - ')
                          : booking.vehicleName}
                      </Text>
                      {isCompactCard ? (
                        <View className="mt-2 gap-1">
                          <Text className="font-sans text-[12px] font-medium leading-5 text-secondary-foreground">
                            Start: {booking.rentalDate}
                          </Text>
                          <Text className="font-sans text-[12px] font-medium leading-5 text-secondary-foreground">
                            End: {booking.returnDate}
                          </Text>
                        </View>
                      ) : (
                        <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                          {booking.rentalDate} → {booking.returnDate}
                        </Text>
                      )}
                      {booking.customer?.name ? (
                        <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                          Customer: {booking.customer.name}
                        </Text>
                      ) : null}
                      {isCompactCard && booking.customer?.phoneNumber ? (
                        <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                          Contact: {booking.customer.phoneNumber}
                        </Text>
                      ) : null}
                    </View>
                    {!isCompactCard ? (
                      <Text className="font-sans rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-primary">
                        {booking.status}
                      </Text>
                    ) : null}
                  </View>
                  <View className="mt-3 flex-row items-start gap-2 border-t border-border pt-3">
                    <MapPin color={themeColors.primary} size={17} />
                    <Text className="font-sans min-w-0 flex-1 text-[12px] font-medium leading-5 text-foreground">
                      JamJade Car Rental Garage
                    </Text>
                  </View>
                  {booking.deliveryLocation && <><Text className="font-sans mt-3 text-body font-semibold text-foreground">{booking.deliveryLocation.address}</Text>{booking.notes ? <Text className="font-sans mt-2 text-caption text-secondary-foreground">Note: {booking.notes}</Text> : null}<DeliveryLocationLink location={booking.deliveryLocation} navigate /></>}
                  {!isCompactCard ? (
                    <Text className="font-sans mt-4 text-[12px] font-semibold text-foreground">
                      {activeServiceStage(booking)}
                    </Text>
                  ) : null}

                  {['Confirmed', 'Active', 'Ongoing'].includes(booking.status) ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/driver-telematics/${encodeURIComponent(booking.id)}` as Href)}
                      className="mt-3 min-h-control flex-row items-center justify-center gap-2 rounded-field bg-primary px-4">
                      <Text className="font-sans text-[13px] font-semibold text-surface">
                        {booking.status === 'Confirmed' ? 'Open vehicle setup' : 'Open Telematics'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {driverBalance > 0 ? (
                    <Pressable
                      onPress={() =>
                        router.push(`/driver-payment?bookingId=${encodeURIComponent(booking.id)}` as Href)
                      }
                      className="mt-3 min-h-control flex-row items-center justify-center gap-2 rounded-field border border-primary bg-surface">
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
