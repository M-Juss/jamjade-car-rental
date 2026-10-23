import { themeColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettlementPaymentCard } from '@/components/payments/SettlementPaymentCard';
import { getSettlementSummary } from '@/lib/payments/settlement-summary';
import { getPaymentErrorMessage } from '@/lib/payments/payment-error';
import { createPayPalCallbackUrls } from '@/lib/payments/paypal-callbacks';
import {
  abandonPayPalOrder,
  capturePayPalOrder,
  createDriverOutstandingPayPalOrder,
  getDriverService,
} from '@/services/api';
import type { Booking } from '@/types/booking';

WebBrowser.maybeCompleteAuthSession();

export default function DriverPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setMessage('Service reference is missing.');
      setIsLoading(false);
      return;
    }
    void getDriverService(bookingId)
      .then(setBooking)
      .catch(() => setMessage('Driver charges could not be loaded.'))
      .finally(() => setIsLoading(false));
  }, [bookingId]);

  const summary = booking ? getSettlementSummary(booking, 'driver') : null;

  const pay = async () => {
    if (!booking || !summary || summary.amount <= 0 || isProcessing) return;
    setIsProcessing(true);
    setMessage(null);
    let orderId: string | null = null;
    let approved = false;

    try {
      const { returnUrl, cancelUrl, sessionReturnUrl } = createPayPalCallbackUrls('driver');
      const order = await createDriverOutstandingPayPalOrder(booking.id, returnUrl, cancelUrl);
      orderId = order.orderId;
      if (Math.round(order.amount * 100) !== Math.round(summary.amount * 100)) {
        await abandonPayPalOrder(order.orderId);
        setBooking(await getDriverService(booking.id));
        setMessage('The amount due changed. Review the updated balance before paying.');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(order.approvalUrl, sessionReturnUrl);

      if (result.type !== 'success') {
        await abandonPayPalOrder(order.orderId);
        setMessage(
          'The PayPal checkout was closed before payment approval. No payment was made; please try again.',
        );
        return;
      }

      if (result.type === 'success' && result.url.includes('/driver-cancel')) {
        await abandonPayPalOrder(order.orderId);
        setMessage('The PayPal payment was cancelled.');
        return;
      }

      approved = true;
      await capturePayPalOrder(order.orderId);
      setMessage('Driver balance paid successfully. You are eligible for new assignments again.');
      setBooking(await getDriverService(booking.id));
    } catch (error) {
      if (orderId && !approved) await abandonPayPalOrder(orderId).catch(() => undefined);
      setMessage(getPaymentErrorMessage(error, 'The Driver balance payment could not be completed.'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-5">
        <View className="w-full max-w-[560px] self-center px-screen">
          <View className="flex-row items-center gap-3 py-3">
            <Pressable
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface">
              <ArrowLeft color={themeColors.foreground} size={21} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[24px] font-semibold text-foreground">Driver Balance</Text>
              <Text className="font-sans text-[12px] font-medium text-secondary-foreground">{bookingId}</Text>
            </View>
          </View>

          {isLoading ? <ActivityIndicator className="mt-12" color={themeColors.primary} /> : null}
          {summary ? (
            <SettlementPaymentCard
              summary={summary}
              isProcessing={isProcessing}
              message={message}
              onPay={() => void pay()}
            />
          ) : !isLoading ? (
            <Text className="font-sans mt-5 text-[13px] font-medium text-destructive">{message}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
