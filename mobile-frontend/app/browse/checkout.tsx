import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BookingStepper,
  ErrorState,
  PriceBreakdownCard,
  SelectedVehicleSummary,
  browseIcons,
} from '@/components/browse';
import { decodeBookingData, encodeBookingData } from '@/lib/browse/booking-params';
import { getPriceBreakdown, getVehicleById } from '@/lib/browse/pricing';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function SummaryCard({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5 rounded-[28px] border border-[#E6EEFF] bg-white p-5 shadow-md shadow-[#17315F]/5">
      <Text className="mb-3 text-[18px] font-black text-[#17315F]">{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text className="min-w-0 flex-1 text-[13px] font-bold text-[#6C7A96]">{label}</Text>
      <Text className="max-w-[58%] text-right text-[13px] font-black text-[#17315F]">{value}</Text>
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { booking: bookingParam } = useLocalSearchParams<{ booking?: string }>();
  const booking = decodeBookingData(bookingParam);
  const vehicle = getVehicleById(booking?.vehicleId);
  const [termsRead, setTermsRead] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const breakdown = useMemo(() => {
    if (!vehicle || !booking) {
      return null;
    }

    return getPriceBreakdown(vehicle, booking.numberOfDays, booking.driverOption, booking.ownerDriverCoverage);
  }, [booking, vehicle]);

  if (!booking || !vehicle || !breakdown) {
    return <ErrorState onAction={() => router.replace('/')} title="Booking not found" subtitle="Start again from an available vehicle." />;
  }

  const coverageLabel =
    booking.ownerDriverCoverage === 'outside_manila' ? 'Outside Manila' : 'Within Metro Manila';
  const canProceedToPayment = termsRead && termsAccepted;

  const handleProceedToPayment = () => {
    if (!canProceedToPayment) {
      return;
    }

    const encodedBooking = encodeBookingData({
      ...booking,
      totalAmount: breakdown.totalAmount,
      downPaymentAmount: breakdown.downPaymentAmount,
      remainingBalance: breakdown.remainingBalance,
    });

    router.push(`/browse/payment?booking=${encodedBooking}` as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-6 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-full bg-white">
              <browseIcons.Car size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[27px] font-black text-[#17315F]">Review Booking</Text>
              <Text className="mt-1 text-[13px] font-semibold text-[#6C7A96]">Confirm details before payment</Text>
            </View>
          </View>

          <View className="mt-5">
            <BookingStepper step={2} />
          </View>

          <View className="mt-6">
            <SelectedVehicleSummary vehicle={vehicle} />
          </View>

          <SummaryCard title="Rental Details">
            <DetailRow label="Rental date" value={booking.rentalDate} />
            <DetailRow label="Return date" value={booking.returnDate} />
            <DetailRow label="Number of days" value={`${booking.numberOfDays}`} />
            <DetailRow label="Pickup option" value={booking.pickupOption === 'shop' ? 'Shop Pickup' : 'Delivery'} />
            <DetailRow label="Pickup location" value={booking.pickupLocation} />
            <DetailRow label="Driver option" value={booking.driverOption === 'self_drive' ? 'Self-drive' : "Owner's Driver"} />
            {booking.driverOption === 'owners_driver' && <DetailRow label="Trip coverage" value={coverageLabel} />}
          </SummaryCard>

          <View className="mt-5">
            <PriceBreakdownCard breakdown={breakdown} />
          </View>

          <SummaryCard title="Terms and Conditions">
            {!termsRead ? (
              <View>
                <Text className="text-[13px] font-semibold leading-5 text-[#6C7A96]">
                  Read the rental terms before proceeding to payment.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTermsRead(true)}
                  className="mt-4 min-h-[50px] items-center justify-center rounded-full bg-[#EEF4FF]">
                  <Text className="text-[14px] font-black text-[#346EF6]">Read Terms and Conditions</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {[
                  'Booking details must be accurate before payment.',
                  'Payment does not guarantee approval until Jamjade confirms the booking.',
                  'Late returns, toll fees, damage fees, and route-related charges may be settled separately.',
                  'Cancellations and refunds are subject to Jamjade review.',
                ].map((term) => (
                  <View key={term} className="mb-3 flex-row gap-2">
                    <browseIcons.CircleCheck size={16} color="#159947" strokeWidth={2.35} />
                    <Text className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-[#5D6B82]">{term}</Text>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: termsAccepted }}
                  onPress={() => setTermsAccepted((value) => !value)}
                  className={cx(
                    'mt-2 flex-row items-start gap-3 rounded-[22px] border p-4',
                    termsAccepted ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
                  )}>
                  <View className={cx('h-7 w-7 items-center justify-center rounded-full border', termsAccepted ? 'border-[#346EF6] bg-[#346EF6]' : 'border-[#C8D4E8] bg-white')}>
                    {termsAccepted && <browseIcons.Check size={16} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text className="min-w-0 flex-1 text-[13px] font-bold leading-5 text-[#17315F]">
                    I have read and agree to the Terms and Conditions.
                  </Text>
                </Pressable>
              </View>
            )}
          </SummaryCard>

          <View className="mt-7 gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canProceedToPayment }}
              disabled={!canProceedToPayment}
              onPress={handleProceedToPayment}
              className={cx(
                'min-h-[60px] items-center justify-center rounded-full shadow-lg',
                canProceedToPayment ? 'bg-[#346EF6] shadow-[#346EF6]/25' : 'bg-[#C8D4E8] shadow-transparent',
              )}>
              <Text className="text-[16px] font-black text-white">Proceed to Payment</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="min-h-[56px] items-center justify-center rounded-full border border-[#DDE8FF] bg-white">
              <Text className="text-[15px] font-black text-[#17315F]">Back to Edit</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
