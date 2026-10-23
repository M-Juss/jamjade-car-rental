import type { LateReturnPolicy } from '@/types/browse';
import { themeColors } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingStepper, ErrorState, PriceBreakdownCard, SelectedVehicleSummary } from '@/components/browse';
import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { TermsSignatureModal } from '@/components/browse/TermsSignatureModal';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import { getBookingFlow, resetBookingFlow, submitBookingTerms } from '@/lib/browse/booking-flow';
import { formatBookingDate, getPriceBreakdown } from '@/lib/browse/pricing';
import { formatDeliveryTime } from '@/lib/browse/rental-config';

function SummaryCard({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5 rounded-card border border-border bg-surface p-card ">
      <Text className="font-sans mb-3 text-[18px] font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text className="font-sans min-w-0 flex-1 text-[13px] font-medium text-secondary-foreground">
        {label}
      </Text>
      <Text className="font-sans max-w-[58%] text-right text-[13px] font-semibold text-foreground">
        {value}
      </Text>
    </View>
  );
}

function CheckoutScreen() {
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
  const [termsPolicy, setTermsPolicy] = useState<LateReturnPolicy | null>(null);

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

    if (booking.deliveryQuoteId && booking.priceBreakdown) return booking.priceBreakdown;
    return getPriceBreakdown(
      vehicle,
      booking.numberOfDays,
      booking.driverOption,
      booking.pickupOption,
      booking.ownerDriverCoverage,
      booking.pickupLocation,
    );
  }, [booking, vehicle]);

  if (booking && flowId && isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
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

  if (!vehicle || !vehicle.lateReturnPolicy || !breakdown) {
    return (
      <ErrorState
        actionLabel={error ? 'Try Again' : 'Restart Booking'}
        title="Vehicle unavailable"
        subtitle={error ?? 'The selected vehicle could not be loaded.'}
        onAction={() => (error ? void reload() : restartBooking())}
      />
    );
  }

  const coverageLabel =
    booking.ownerDriverCoverage === 'outside_manila' ? 'Outside Manila' : 'Within Metro Manila';

  const handleSubmitSignature = (signature: string) => {
    const nextFlow = submitBookingTerms(flowId, signature, termsPolicy ?? vehicle.lateReturnPolicy, breakdown);

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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Back to booking details"
              accessibilityRole="button"
              onPress={restartBooking}
              className="h-12 w-12 items-center justify-center rounded-full bg-surface">
              <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-title font-semibold text-foreground">Review Booking</Text>
            </View>
          </View>

          <View className="mt-5">
            <BookingStepper step={2} />
          </View>

          <View className="mt-5">
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
            {booking.notes ? <DetailRow label="Note" value={booking.notes} /> : null}
            {booking.deliveryTime ? (
              <>
                <DetailRow label="Pickup time" value={formatDeliveryTime(booking.deliveryTime)} />
                <DetailRow label="End trip location" value={booking.pickupLocation} />
                <DetailRow label="End time" value={formatDeliveryTime(booking.deliveryTime)} />
              </>
            ) : null}
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
            <Text className="font-sans text-[13px] font-normal leading-5 text-secondary-foreground">
              Review the full rental conditions and provide your signature. Payment remains locked until the
              signed terms are submitted.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => { setTermsPolicy(vehicle.lateReturnPolicy); setIsTermsOpen(true); }}
              className="mt-4 min-h-[54px] items-center justify-center rounded-full bg-primary">
              <Text className="font-sans text-[14px] font-semibold text-surface">
                Read Terms and Conditions
              </Text>
            </Pressable>
          </SummaryCard>
        </View>
      </ScrollView>

      <TermsSignatureModal
        lateReturnPolicy={termsPolicy ?? vehicle.lateReturnPolicy}
        onClose={() => setIsTermsOpen(false)}
        onSubmit={handleSubmitSignature}
        visible={isTermsOpen}
      />
    </SafeAreaView>
  );
}

export default function ProtectedCheckoutScreen() {
  return (
    <AuthenticatedOnly>
      <CheckoutScreen />
    </AuthenticatedOnly>
  );
}
