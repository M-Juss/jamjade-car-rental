import { themeColors } from '@/constants/theme';
import { receiptSuccessRoute } from '@/lib/payments/receipt';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { firstParam } from '@/lib/browse/booking-params';
import { SettlementPaymentCard } from '@/components/payments/SettlementPaymentCard';
import { getSettlementSummary } from '@/lib/payments/settlement-summary';
import { getPaymentErrorMessage } from '@/lib/payments/payment-error';
import { createPayPalCallbackUrls } from '@/lib/payments/paypal-callbacks';
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

  const summary = booking ? getSettlementSummary(booking) : null;

  const payBalance = async () => {
    if (!booking || !summary || summary.amount <= 0 || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    let orderId: string | null = null;
    let approved = false;

    try {
      const { returnUrl, cancelUrl, sessionReturnUrl } = createPayPalCallbackUrls();
      const order = await createRemainingBalancePayPalOrder(booking.id, returnUrl, cancelUrl);
      orderId = order.orderId;
      if (Math.round(order.amount * 100) !== Math.round(summary.amount * 100)) {
        await abandonPayPalOrder(order.orderId);
        setBooking(await getBooking(booking.id));
        setError('The amount due changed. Review the updated balance before paying.');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(order.approvalUrl, sessionReturnUrl);

      if (result.type !== 'success') {
        await abandonPayPalOrder(order.orderId);
        router.replace(
          `/browse/success?status=failed&source=balance&message=${encodeURIComponent('The PayPal checkout was closed before payment approval. No payment was made; please try again.')}&retryPath=${encodeURIComponent(`/bookings/payment?bookingId=${booking.id}`)}` as Href,
        );
        return;
      }

      if (result.url.includes('/cancel')) {
        await abandonPayPalOrder(order.orderId);
        router.replace(
          `/browse/success?status=failed&source=balance&message=${encodeURIComponent('The payment was cancelled.')}&retryPath=${encodeURIComponent(`/bookings/payment?bookingId=${booking.id}`)}` as Href,
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
        receiptSuccessRoute(order.orderId, capturedBooking.bookingCode) as Href,
      );
    } catch (paymentError) {
      const message = getPaymentErrorMessage(
        paymentError,
        'The payment could not be completed.',
      );

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
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-5">
        <View className="w-full max-w-[560px] self-center px-screen py-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-field border border-border bg-surface">
              <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[25px] font-semibold text-foreground">Settle Balance</Text>
              <Text className="font-sans mt-1 text-[13px] font-medium text-secondary-foreground">
                {booking?.id}
              </Text>
            </View>
          </View>

          {summary ? (
            <SettlementPaymentCard
              summary={summary}
              isProcessing={isProcessing}
              message={error}
              onPay={() => void payBalance()}
            />
          ) : (
            <View className="mt-section rounded-card border border-destructive-border bg-destructive-surface p-card">
              <Text className="font-sans text-[14px] font-medium text-destructive">
                {error ?? 'Booking not found.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
