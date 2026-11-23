import { DriverWorkflowForm } from '@/forms/booking/DriverWorkflowForm';
import { BookingDetailsContent } from "@/components/bookings/BookingDetailsContent";
import { themeColors } from "@/constants/theme";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import {
  ArrowLeft,
  RotateCcw,
  Navigation,
  CreditCard,
  CircleX,
  Star,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useCallback, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActionButton,
  BookingEmptyState,
  BookingStatusBadge,
} from "@/components/bookings";
import { getBooking, getDriverService } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { ApiError } from "@/services/http";
import { CancelBookingForm } from '@/forms/booking/CancelBookingForm';
import { BookingFeedbackForm } from '@/forms/booking/BookingFeedbackForm';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import type { Booking } from "@/types/booking";

export function BookingDetailsScreen({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isDriver = user?.roles?.includes('driver') ?? false;
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const mutationRevision = useRef(0);
  const bookingRef = useRef(booking);
  bookingRef.current = booking;
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const toast = useFormToast();

  const loadBooking = useCallback(async (quiet = false) => {
    if (!bookingId) {
      setIsLoading(false);
      return;
    }

    if (!quiet) {
      setIsLoading(true);
      setLoadError(null);
    }

    const revision = mutationRevision.current;
    try {
      const record = await (isDriver ? getDriverService(bookingId) : getBooking(bookingId));
      if (revision === mutationRevision.current) setBooking(record);
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        setBooking(null);
        setLoadError(isDriver ? 'This service is no longer assigned to you.' : 'This booking is no longer available.');
      } else if (!quiet) setLoadError("Booking could not be loaded. Please try again.");
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [bookingId, isDriver]);

  useFocusEffect(
    useCallback(() => {
      void loadBooking();
      const interval = setInterval(() => {
        const current = bookingRef.current;
        if (isDriver || (current?.driverType === "Owner's Driver" && ['Confirmed', 'Active'].includes(current.status))) {
          void loadBooking(true);
        }
      }, 15000);
      return () => clearInterval(interval);
    }, [loadBooking, isDriver]),
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 justify-center bg-background px-screen">
        <BookingEmptyState
          title="Booking Not Found"
          subtitle={loadError ?? "We could not find that booking."}
          buttonLabel={isDriver ? 'Back to Services' : 'Back to Bookings'}
          onBrowsePress={() => router.replace(isDriver ? '/(driver)/services' : '/bookings' as Href)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{
            paddingBottom: 34 + insets.bottom,
            paddingTop: insets.top + 10,
          }}
        >
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-field border border-border bg-surface"
            >
              <ArrowLeft
                size={21}
                color={themeColors.foreground}
                strokeWidth={2}
              />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text
                accessibilityRole="header"
                className="font-sans text-title font-semibold text-foreground"
              >
                {booking.id}
              </Text>
            </View>
            <View className="shrink-0">
              <BookingStatusBadge status={booking.status} compact />
            </View>
          </View>

          <View className="mt-section gap-4">
            <BookingDetailsContent booking={booking} audience={isDriver ? 'driver' : 'customer'} />
            {['Returned', 'Completed'].includes(booking.status) && (isDriver || booking.driverType === 'Self-Drive') ? (
              <ActionButton density="compact" icon={Navigation} label="Telematics activity"
                onPress={() => router.push(`/${isDriver ? 'driver-telematics' : 'telematics'}/${encodeURIComponent(booking.id)}?tab=activity` as Href)} />
            ) : null}
            {isDriver && booking.status === 'Confirmed' && booking.driverWorkflow ? <DriverWorkflowForm bookingId={booking.backendId} bookingCode={booking.id} workflow={booking.driverWorkflow} pickupType={booking.pickupType} onUpdated={(updated) => { mutationRevision.current += 1; setBooking(updated); if (updated.status === 'Active') router.replace({ pathname: '/(driver)/services', params: { tab: 'active' } }); }} /> : null}
            {isDriver ? <View className="flex-row flex-wrap gap-2">
              {['Active', 'Ongoing'].includes(booking.status) ? <ActionButton density="compact" className="min-w-[45%] flex-1"
                label="Telematics" icon={Navigation} variant="primary" onPress={() => router.push(`/driver-telematics/${encodeURIComponent(booking.id)}` as Href)} /> : null}
              {booking.additionalCharges.some(charge => charge.outstandingAmount > 0) ? <ActionButton density="compact" className="min-w-[45%] flex-1"
                label="Pay charges" icon={CreditCard} onPress={() => router.push(`/driver-payment?bookingId=${encodeURIComponent(booking.id)}` as Href)} /> : null}
            </View> : null}
            {!isDriver && booking.canReviseUnpaid ? (
              <View className="w-full flex-row">
                <ActionButton density="compact" className="flex-1" icon={CreditCard} label="Edit dates and pay" variant="primary"
                  onPress={() => router.push(`/browse/booking?vehicleId=${encodeURIComponent(booking.vehicleId)}&bookingId=${encodeURIComponent(booking.id)}` as Href)} />
              </View>
            ) : null}
            {!isDriver && booking.status === 'Pending' && booking.paymentStatus === 'Unpaid' && !booking.canReviseUnpaid && !booking.canCancelUnpaid ? (
              <Text className="font-sans text-body text-secondary-foreground">Payment is awaiting confirmation. Contact JamJade if confirmation is unavailable.</Text>
            ) : null}
            {!isDriver && booking.canCancelUnpaid ? (
              <View className="w-full flex-row">
                <ActionButton density="compact" className="flex-1" icon={CircleX} label="Cancel booking" variant="danger"
                  onPress={() => setIsCancelOpen(true)} />
              </View>
            ) : null}
            {!isDriver && ['Completed', 'Cancelled', 'Rejected', 'No-show'].includes(booking.status) ? (
              <ActionButton
                density="compact"
                className="self-start"
                icon={RotateCcw}
                label="Book Again"
                variant="primary"
                onPress={() => router.push("/" as Href)}
              />
            ) : null}
            {!isDriver && booking.status === 'Completed' && (booking.canLeaveFeedback || booking.feedback) ? <ActionButton density="compact" icon={Star} label={booking.feedback ? 'View feedback' : 'Leave feedback'} onPress={() => setIsFeedbackOpen(true)} /> : null}
          </View>
        </View>
      </ScrollView>
      {!isDriver ? <CancelBookingForm bookingId={booking.id} visible={isCancelOpen} onClose={() => {
        setIsCancelOpen(false);
        void loadBooking(true);
      }}
        onCancelled={(updated) => {
          setBooking(updated);
          setIsCancelOpen(false);
          toast.showToast('Booking cancelled.', 'success');
        }} /> : null}
      <FormToast message={toast.message} title={toast.title} variant={toast.variant} onDismiss={toast.clearToast} />
      {!isDriver && isFeedbackOpen ? <BookingFeedbackForm key={booking.backendId} booking={booking} onClose={() => { setIsFeedbackOpen(false); void loadBooking(true); }} onSaved={feedback => {
        mutationRevision.current += 1;
        setBooking(current => current ? { ...current, feedback, canLeaveFeedback: false } : current);
        setIsFeedbackOpen(false);
        toast.showToast('Feedback submitted.', 'success');
      }} /> : null}
    </View>
  );
}
