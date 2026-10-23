import { BookingDetailsContent } from "@/components/bookings/BookingDetailsContent";
import { themeColors } from "@/constants/theme";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import {
  ArrowLeft,
  Navigation,
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
  SectionCard,
  getBookingActions,
  type BookingAction,
} from "@/components/bookings";
import { canSelectTelematicsBooking } from "@/lib/telematics/setup";
import { getBooking } from "@/services/api";
import type { Booking } from "@/types/booking";
import { cx } from "@/components/bookings/utils";


function DetailsActions({
  booking,
  onAction,
}: {
  booking: Booking;
  onAction: (action: BookingAction, booking: Booking) => void;
}) {
  const actions = getBookingActions(booking.status, {
    includeDetails: false,
    isSelfDrive: booking.driverType === "Self-Drive",
  }).filter(
    (action) => action.key !== "pay_balance" || booking.remainingBalance > 0,
  );
  const primaryActionKeys: BookingAction["key"][] = [
    "payment_info",
    "pay_balance",
    "open_telematics",
    "book_again",
    "book_another_vehicle",
  ];
  const primaryActions = actions.filter((action) =>
    primaryActionKeys.includes(action.key),
  );
  const supportingActions = actions.filter(
    (action) => !primaryActionKeys.includes(action.key),
  );

  if (actions.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Actions" icon={Navigation}>
      <View className="gap-4">
        {primaryActions.length > 0 ? (
          <View className="gap-3">
            {primaryActions.map((action) => (
              <ActionButton
                key={action.key}
                className="w-full"
                icon={action.icon}
                label={action.label}
                variant={action.variant}
                onPress={() => onAction(action, booking)}
              />
            ))}
          </View>
        ) : null}
        {supportingActions.length > 0 ? (
          <View
            className={cx(
              "gap-3",
              primaryActions.length > 0 && "border-t border-border pt-4",
            )}
          >
            {primaryActions.length > 0 ? (
              <Text className="font-sans text-[11px] font-normal text-secondary-foreground">
                More actions
              </Text>
            ) : null}
            {supportingActions.map((action) => (
              <ActionButton
                key={action.key}
                className="w-full"
                icon={action.icon}
                label={action.label}
                variant={action.variant}
                onPress={() => onAction(action, booking)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

export function BookingDetailsScreen({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
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
      setBooking(await getBooking(bookingId));
    } catch {
      if (!quiet) setLoadError("Booking could not be loaded. Please try again.");
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void loadBooking();
      const interval = setInterval(() => {
        const current = bookingRef.current;
        if (current?.driverType === "Owner's Driver" && current.status === "Active") {
          void loadBooking(true);
        }
      }, 15000);
      return () => clearInterval(interval);
    }, [loadBooking]),
  );

  const handleAction = (action: BookingAction, selectedBooking: Booking) => {
    if (action.key === "pay_balance" || action.key === "payment_info") {
      router.push(
        `/bookings/payment?bookingId=${encodeURIComponent(selectedBooking.id)}` as Href,
      );
      return;
    }

    if (
      action.key === "open_telematics" &&
      canSelectTelematicsBooking(selectedBooking)
    ) {
      router.push(`/telematics/${encodeURIComponent(selectedBooking.id)}` as Href);
      return;
    }

    if (action.key === "book_another_vehicle" || action.key === "book_again") {
      router.push("/" as Href);
      return;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 justify-center bg-background px-5">
        <BookingEmptyState
          title="Booking Not Found"
          subtitle={loadError ?? "We could not find that booking."}
          buttonLabel="Back to Bookings"
          onBrowsePress={() => router.replace("/bookings" as Href)}
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
              className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface"
            >
              <ArrowLeft
                size={21}
                color={themeColors.foreground}
                strokeWidth={2.45}
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

          <View className="mt-6 gap-4">
            <BookingDetailsContent booking={booking} />

            <DetailsActions booking={booking} onAction={handleAction} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
