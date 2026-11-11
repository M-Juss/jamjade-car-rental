import { BookingDetailsContent } from "@/components/bookings/BookingDetailsContent";
import { themeColors } from "@/constants/theme";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import {
  ArrowLeft,
  RotateCcw,
  Navigation,
  CreditCard,
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
import type { Booking } from "@/types/booking";

export function BookingDetailsScreen({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isDriver = user?.roles?.includes('driver') ?? false;
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const bookingRef = useRef(booking);
  bookingRef.current = booking;
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBooking = useCallback(async (quiet = false) => {
    if (!bookingId) {
      setIsLoading(false);
      return;
    }

    if (!quiet) {
      setIsLoading(true);
      setLoadError(null);
    }

    try {
      setBooking(await (isDriver ? getDriverService(bookingId) : getBooking(bookingId)));
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
        if (isDriver || (current?.driverType === "Owner's Driver" && current.status === "Active")) {
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
            {isDriver ? <View className="flex-row flex-wrap gap-2">
              {['Confirmed', 'Active', 'Ongoing'].includes(booking.status) ? <ActionButton density="compact" className="min-w-[45%] flex-1"
                label="Telematics" icon={Navigation} variant="primary" onPress={() => router.push(`/driver-telematics/${encodeURIComponent(booking.id)}` as Href)} /> : null}
              {booking.additionalCharges.some(charge => charge.outstandingAmount > 0) ? <ActionButton density="compact" className="min-w-[45%] flex-1"
                label="Pay charges" icon={CreditCard} onPress={() => router.push(`/driver-payment?bookingId=${encodeURIComponent(booking.id)}` as Href)} /> : null}
            </View> : null}
            {!isDriver && booking.canReviseUnpaid ? (
              <ActionButton density="compact" className="w-full" icon={CreditCard} label="Edit dates and pay" variant="primary"
                onPress={() => router.push(`/browse/booking?vehicleId=${encodeURIComponent(booking.vehicleId)}&bookingId=${encodeURIComponent(booking.id)}` as Href)} />
            ) : null}
            {!isDriver && booking.status === 'Pending' && booking.paymentStatus === 'Unpaid' && !booking.canReviseUnpaid ? (
              <Text className="font-sans text-body text-secondary-foreground">Payment is awaiting confirmation. Contact JamJade if confirmation is unavailable.</Text>
            ) : null}
            {!isDriver && ['Completed', 'Cancelled', 'Rejected'].includes(booking.status) ? (
              <ActionButton
                density="compact"
                className="self-start"
                icon={RotateCcw}
                label="Book Again"
                variant="primary"
                onPress={() => router.push("/" as Href)}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
