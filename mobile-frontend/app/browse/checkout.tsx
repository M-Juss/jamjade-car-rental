import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BookingStepper,
  ErrorState,
  PriceBreakdownCard,
  SelectedVehicleSummary,
  browseIcons,
  optionalServices,
} from '@/components/browse';
import { decodeBookingData, encodeBookingData } from '@/lib/browse/booking-params';
import { REQUIRED_DOCUMENTS } from '@/lib/browse/mock-data';
import { formatPeso, getPriceBreakdown, getVehicleById } from '@/lib/browse/pricing';

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
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showAgreementError, setShowAgreementError] = useState(false);

  const breakdown = useMemo(() => {
    if (!vehicle || !booking) {
      return null;
    }

    return getPriceBreakdown(vehicle, booking.numberOfDays, booking.optionalServices, booking.paymentOption);
  }, [booking, vehicle]);

  if (!booking || !vehicle || !breakdown) {
    return <ErrorState onAction={() => router.replace('/')} title="Booking not found" subtitle="Start again from an available vehicle." />;
  }

  const selectedServiceLabels = booking.optionalServices
    .map((serviceId) => optionalServices.find((service) => service.id === serviceId)?.label)
    .filter((label): label is string => Boolean(label));

  const handleSubmit = () => {
    if (!agreementAccepted) {
      setShowAgreementError(true);
      return;
    }

    const reference = `JJ-${Date.now().toString().slice(-6)}`;

    const encodedBooking = encodeBookingData({
      ...booking,
      totalAmount: breakdown.totalAmount,
      downPaymentAmount: breakdown.downPaymentAmount,
      remainingBalance: breakdown.remainingBalance,
    });

    router.replace(`/browse/success?booking=${encodedBooking}&reference=${reference}` as Href);
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
              <Text className="mt-1 text-[13px] font-semibold text-[#6C7A96]">Confirm details before submission</Text>
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
          </SummaryCard>

          {booking.driverOption === 'self_drive' && (
            <SummaryCard title="Required Documents Reminder">
              <View className="gap-2">
                {REQUIRED_DOCUMENTS.map((document) => (
                  <View key={document} className="flex-row items-center gap-2">
                    <browseIcons.FileCheck2 size={17} color="#346EF6" strokeWidth={2.35} />
                    <Text className="text-[13px] font-bold text-[#17315F]">{document}</Text>
                  </View>
                ))}
              </View>
            </SummaryCard>
          )}

          <SummaryCard title="Optional Services">
            {selectedServiceLabels.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {selectedServiceLabels.map((label) => (
                  <View key={label} className="rounded-full bg-[#EEF4FF] px-3 py-2">
                    <Text className="text-[12px] font-black text-[#346EF6]">{label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-[13px] font-semibold text-[#6C7A96]">No optional services selected.</Text>
            )}
          </SummaryCard>

          <View className="mt-5">
            <PriceBreakdownCard breakdown={breakdown} />
          </View>

          <SummaryCard title="Payment">
            <View className="gap-3">
              <View className="rounded-2xl border border-[#E6EEFF] bg-[#F8FAFF] px-4 py-3">
                <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">Payment method</Text>
                <Text className="mt-1 text-[14px] font-black text-[#17315F]">Payment method placeholder</Text>
              </View>
              <View className="rounded-2xl border border-[#E6EEFF] bg-white px-4 py-3">
                <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">Reference number</Text>
                <TextInput placeholder="Reference number placeholder" placeholderTextColor="#9AA4B8" className="text-[14px] font-bold text-[#17315F]" />
              </View>
              <View className="min-h-[94px] items-center justify-center rounded-2xl border border-dashed border-[#C8D4E8] bg-[#F8FAFF] px-4 py-5">
                <browseIcons.Upload size={24} color="#346EF6" strokeWidth={2.35} />
                <Text className="mt-2 text-[13px] font-black text-[#17315F]">Upload proof of payment placeholder</Text>
              </View>
              <View className="flex-row items-center justify-between rounded-2xl bg-[#FFF9E8] px-4 py-3">
                <Text className="text-[13px] font-bold text-[#806128]">Payment status</Text>
                <Text className="text-[13px] font-black text-[#B7791F]">Pending verification</Text>
              </View>
            </View>
          </SummaryCard>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreementAccepted }}
            onPress={() => {
              setAgreementAccepted((value) => !value);
              setShowAgreementError(false);
            }}
            className={cx(
              'mt-5 flex-row items-start gap-3 rounded-[24px] border p-4',
              agreementAccepted ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
            )}>
            <View className={cx('h-7 w-7 items-center justify-center rounded-full border', agreementAccepted ? 'border-[#346EF6] bg-[#346EF6]' : 'border-[#C8D4E8] bg-white')}>
              {agreementAccepted && <browseIcons.Check size={16} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text className="min-w-0 flex-1 text-[13px] font-bold leading-5 text-[#17315F]">
              I understand that my booking is subject to admin approval and payment verification.
            </Text>
          </Pressable>
          {showAgreementError && (
            <Text className="mt-2 px-2 text-[12px] font-bold text-[#D92D20]">Please accept the agreement before submitting.</Text>
          )}

          <View className="mt-7 gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={handleSubmit}
              className="min-h-[60px] items-center justify-center rounded-full bg-[#346EF6] shadow-lg shadow-[#346EF6]/25">
              <Text className="text-[16px] font-black text-white">Submit Booking</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="min-h-[56px] items-center justify-center rounded-full border border-[#DDE8FF] bg-white">
              <Text className="text-[15px] font-black text-[#17315F]">Back to Edit</Text>
            </Pressable>
          </View>

          <View className="mt-4 rounded-[20px] bg-[#EEF4FF] p-4">
            <Text className="text-[12px] font-bold leading-5 text-[#346EF6]">
              Mock checkout only. No real payment gateway or backend submission is connected. Total due: {formatPeso(breakdown.totalAmount)}.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
