import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, CreditCard, ShieldAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { firstParam } from '@/lib/browse/booking-params';
import { formatPeso } from '@/lib/browse/pricing';
import {
  abandonPayPalOrder,
  capturePayPalOrder,
  createRemainingBalancePayPalOrder,
  getBooking,
} from '@/services/api';
import type { Booking } from '@/types/booking';

WebBrowser.maybeCompleteAuthSession();

export default function RemainingBalancePaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = firstParam(params.bookingId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setError('Booking reference is missing.');
      setIsLoading(false);
      return;
    }

    void getBooking(bookingId)
      .then(setBooking)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Booking could not be loaded.');
      })
      .finally(() => setIsLoading(false));
  }, [bookingId]);

  const payBalance = async () => {
    if (!booking || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    let orderId: string | null = null;
    let approved = false;

    try {
      const redirectUrl = Linking.createURL('paypal/return');
      const cancelUrl = Linking.createURL('paypal/cancel');
      const order = await createRemainingBalancePayPalOrder(
        booking.id,
        redirectUrl,
        cancelUrl,
      );
      orderId = order.orderId;
      const result = await WebBrowser.openAuthSessionAsync(order.approvalUrl, redirectUrl);

      if (result.type !== 'success') {
        approved = true;

        try {
          const capturedBooking = await capturePayPalOrder(order.orderId);
          router.replace(
            `/browse/success?status=success&source=balance&reference=${encodeURIComponent(capturedBooking.bookingCode)}&paymentStatus=${encodeURIComponent(capturedBooking.paymentStatus)}&remainingBalance=${encodeURIComponent(String(capturedBooking.remainingBalance))}` as Href,
          );
          return;
        } catch {
          router.replace(
            `/browse/success?status=failed&source=balance&message=${encodeURIComponent('The PayPal window closed before the app received confirmation. If PayPal showed “Thanks for using PayPal”, confirm the payment below.')}&orderId=${encodeURIComponent(order.orderId)}&retryPath=${encodeURIComponent(`/bookings/payment?bookingId=${booking.id}`)}` as Href,
          );
          return;
        }
      }

      if (result.url.includes('/cancel')) {
        await abandonPayPalOrder(order.orderId);
        router.replace(
          `/browse/success?status=failed&source=balance&message=${encodeURIComponent('The remaining balance payment was cancelled.')}&retryPath=${encodeURIComponent(`/bookings/payment?bookingId=${booking.id}`)}` as Href,
        );
        return;
      }

      const redirect = Linking.parse(result.url);
      const returnedOrderId = redirect.queryParams?.token;

      if (typeof returnedOrderId === 'string' && returnedOrderId !== order.orderId) {
        throw new Error('PayPal returned a different order reference.');
      }

      approved = true;
      const capturedBooking = await capturePayPalOrder(order.orderId);
      router.replace(
        `/browse/success?status=success&source=balance&reference=${encodeURIComponent(capturedBooking.bookingCode)}&paymentStatus=${encodeURIComponent(capturedBooking.paymentStatus)}&remainingBalance=${encodeURIComponent(String(capturedBooking.remainingBalance))}` as Href,
      );
    } catch (paymentError) {
      const message = paymentError instanceof Error
        ? paymentError.message
        : 'The remaining balance payment could not be completed.';

      if (orderId && !approved) {
        await abandonPayPalOrder(orderId).catch(() => undefined);
      }

      router.replace(
        `/browse/success?status=failed&source=balance&message=${encodeURIComponent(message)}${approved && orderId ? `&orderId=${encodeURIComponent(orderId)}` : ''}&retryPath=${encodeURIComponent(`/bookings/payment?bookingId=${booking.id}`)}` as Href,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5 py-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface">
            <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[25px] font-black text-foreground">Settle Balance</Text>
            <Text className="mt-1 text-[13px] font-bold text-muted-foreground">{booking?.id}</Text>
          </View>
        </View>

        {booking ? (
          <View className="mt-8 rounded-[32px] border border-border bg-surface p-5">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
              <CreditCard size={27} color="#346EF6" strokeWidth={2.4} />
            </View>
            <Text className="mt-5 text-[13px] font-black uppercase text-subtle-foreground">Amount Due</Text>
            <Text className="mt-1 text-[34px] font-black text-foreground">
              {formatPeso(booking.remainingBalance)}
            </Text>
            <Text className="mt-3 text-[14px] font-bold text-muted-foreground">{booking.vehicleName}</Text>
            <Text className="mt-1 text-[12px] font-semibold text-subtle-foreground">
              PayPal Sandbox payment in PHP
            </Text>

            <View className="mt-6 flex-row items-start gap-3 rounded-[22px] border border-warning-border bg-warning-surface p-4">
              <ShieldAlert size={20} color="#C2410C" strokeWidth={2.4} />
              <Text className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-[#9A3412]">
                Due {booking.balanceDueAt ? new Date(booking.balanceDueAt).toLocaleString() : 'before pickup'}.
                If unpaid by the deadline, the booking is cancelled and the down payment is non-refundable.
              </Text>
            </View>

            {error ? <Text className="mt-4 text-[13px] font-bold text-destructive">{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isProcessing || booking.remainingBalance <= 0}
              onPress={() => void payBalance()}
              className="mt-6 min-h-[60px] flex-row items-center justify-center gap-2 rounded-full bg-[#0070BA]">
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[16px] font-black text-surface">Pay Remaining Balance</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View className="mt-8 rounded-[24px] border border-destructive-border bg-destructive-surface p-5">
            <Text className="text-[14px] font-bold text-destructive">{error ?? 'Booking not found.'}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
