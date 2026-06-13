import { useFocusEffect } from '@react-navigation/native';
import {
  useLocalSearchParams,
  useRootNavigationState,
  useRouter,
  type Href,
} from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BookingStepper,
  ErrorState,
  PriceBreakdownCard,
  SelectedVehicleSummary,
} from '@/components/browse';
import { TermsSignatureModal } from '@/components/browse/TermsSignatureModal';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import {
  getBookingFlow,
  resetBookingFlow,
  submitBookingTerms,
} from '@/lib/browse/booking-flow';
import {
  formatBookingDate,
  getPriceBreakdown,
} from '@/lib/browse/pricing';
import { formatDeliveryTime } from '@/lib/browse/rental-config';

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
  const rootNavigationState = useRootNavigationState();
  const params = useLocalSearchParams<{
    flow?: string | string[];
    vehicleId?: string | string[];
  }>();
  const flowId = firstParam(params.flow);
  const routeVehicleId = firstParam(params.vehicleId);
  const flow = getBookingFlow(flowId);
  const booking = flow?.stage === 'review' ? flow.booking : null;
  const selectedVehicleId = booking?.vehicleId ?? routeVehicleId;
  const { vehicle, isLoading, error, reload } = useVehicle(selectedVehicleId);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const restartBooking = useCallback(() => {
    resetBookingFlow(flowId);

    if (routeVehicleId) {
      router.replace(`/browse/booking?vehicleId=${encodeURIComponent(routeVehicleId)}` as Href);
      return;
    }

    router.replace('/' as Href);
  }, [flowId, routeVehicleId, router]);

  useFocusEffect(
    useCallback(() => {
      if (!rootNavigationState?.key) {
        return;
      }

      const currentFlow = getBookingFlow(flowId);

      if (!currentFlow || currentFlow.stage !== 'review') {
        const redirectTimer = setTimeout(restartBooking, 0);

        return () => clearTimeout(redirectTimer);
      }

      return () => {
        const exitingFlow = getBookingFlow(flowId);

        if (exitingFlow?.stage === 'review') {
          resetBookingFlow(flowId);
        }
      };
    }, [flowId, restartBooking, rootNavigationState?.key]),
  );

  const breakdown = useMemo(() => {
    if (!vehicle || !booking) {
      return null;
    }

    return getPriceBreakdown(
      vehicle,
      booking.numberOfDays,
      booking.driverOption,
      booking.pickupOption,
      booking.ownerDriverCoverage,
    );
  }, [booking, vehicle]);

  if (booking && flowId && isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FAFF]">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  if (!booking || !flowId) {
    return (
      <ErrorState
        onAction={restartBooking}
        title="Booking flow reset"
        subtitle="The required booking step was incomplete. Start the booking again."
      />
    );
  }

  if (!vehicle || !breakdown) {
    return (
      <ErrorState
        actionLabel={error ? 'Try Again' : 'Restart Booking'}
        title="Vehicle unavailable"
        subtitle={error ?? 'The selected vehicle could not be loaded.'}
        onAction={() => error ? void reload() : restartBooking()}
      />
    );
  }

  const coverageLabel =
    booking.ownerDriverCoverage === 'outside_manila' ? 'Outside Manila' : 'Within Metro Manila';

  const handleSubmitSignature = (signature: string) => {
    const nextFlow = submitBookingTerms(flowId, signature);

    if (!nextFlow) {
      restartBooking();
      return;
    }

    setIsTermsOpen(false);
    router.push(
      `/browse/payment?flow=${encodeURIComponent(flowId)}&vehicleId=${encodeURIComponent(vehicle.id)}` as Href,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Back to booking details"
              accessibilityRole="button"
              onPress={restartBooking}
              className="h-12 w-12 items-center justify-center rounded-full bg-white">
              <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[27px] font-black text-[#17315F]">Review Booking</Text>
              <Text className="mt-1 text-[13px] font-semibold text-[#6C7A96]">
                Confirm details and sign the rental terms
              </Text>
            </View>
          </View>

          <View className="mt-5">
            <BookingStepper step={2} />
          </View>

          <View className="mt-6">
            <SelectedVehicleSummary vehicle={vehicle} />
          </View>

          <SummaryCard title="Rental Details">
            <DetailRow label="Rental date" value={formatBookingDate(booking.rentalDate)} />
            <DetailRow label="Return date" value={formatBookingDate(booking.returnDate)} />
            <DetailRow label="Number of days" value={`${booking.numberOfDays}`} />
            <DetailRow
              label="Pickup option"
              value={booking.pickupOption === 'shop' ? 'Shop Pickup' : 'Delivery'}
            />
            <DetailRow label="Pickup location" value={booking.pickupLocation} />
            {booking.pickupOption === 'delivery' && booking.deliveryTime ? (
              <DetailRow label="Delivery time" value={formatDeliveryTime(booking.deliveryTime)} />
            ) : null}
            <DetailRow
              label={booking.driverOption === 'owners_driver' ? 'End trip location' : 'Return location'}
              value={booking.returnLocation}
            />
            <DetailRow
              label="Driver option"
              value={booking.driverOption === 'self_drive' ? 'Self-drive' : "Owner's Driver"}
            />
            {booking.driverOption === 'owners_driver' ? (
              <DetailRow label="Trip coverage" value={coverageLabel} />
            ) : null}
          </SummaryCard>

          <View className="mt-5">
            <PriceBreakdownCard breakdown={breakdown} />
          </View>

          <SummaryCard title="Terms and Conditions">
            <Text className="text-[13px] font-semibold leading-5 text-[#6C7A96]">
              Review the full rental conditions and provide your signature. Payment remains locked until the signed terms are submitted.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsTermsOpen(true)}
              className="mt-4 min-h-[54px] items-center justify-center rounded-full bg-[#346EF6]">
              <Text className="text-[14px] font-black text-white">Read Terms and Conditions</Text>
            </Pressable>
          </SummaryCard>
        </View>
      </ScrollView>

      <TermsSignatureModal
        onClose={() => setIsTermsOpen(false)}
        onSubmit={handleSubmitSignature}
        visible={isTermsOpen}
      />
    </SafeAreaView>
  );
}
