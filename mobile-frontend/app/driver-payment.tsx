import { themeColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettlementPaymentCard } from '@/components/payments/SettlementPaymentCard';
import { getSettlementSummary } from '@/lib/payments/settlement-summary';
import { getPaymentErrorMessage } from '@/lib/payments/payment-error';
import { createPayPalCallbackUrls } from '@/lib/payments/paypal-callbacks';
import { usePayPalBrowser } from '@/hooks/use-paypal-browser';
import {
  abandonPayPalOrder,
  capturePayPalOrder,
  createDriverOutstandingPayPalOrder,
  getDriverService,
  type PayPalOrderResponse,
} from '@/services/api';
import type { Booking } from '@/types/booking';

export default function DriverPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PayPalOrderResponse | null>(null);
  const [approvalCompleted, setApprovalCompleted] = useState(false);
  const openCheckout = usePayPalBrowser();

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
    try {
      const { returnUrl, cancelUrl } = createPayPalCallbackUrls('driver');
      const order = checkout ?? await createDriverOutstandingPayPalOrder(booking.id, returnUrl, cancelUrl);
      setCheckout(order);
      if (!approvalCompleted && Math.round(order.amount * 100) !== Math.round(summary.amount * 100)) {
        await abandonPayPalOrder(order.orderId);
        setCheckout(null);
        setBooking(await getDriverService(booking.id));
        setMessage('The amount due changed. Review the updated balance before paying.');
        return;
      }
      if (!approvalCompleted) {
        const result = await openCheckout(order, 'driver');

        if (result === 'exited') {
          return;
        }

        if (result === 'interrupted') {
          setMessage('Payment not completed. You can continue with PayPal.');
          return;
        }

        if (result === 'cancelled') {
          await abandonPayPalOrder(order.orderId);
          setCheckout(null);
          setMessage('You cancelled the PayPal checkout. You can try again.');
          return;
        }

        setApprovalCompleted(true);
      }

      await capturePayPalOrder(order.orderId);
      setCheckout(null);
      setApprovalCompleted(false);
      setMessage('Driver charges paid successfully.');
      setBooking(await getDriverService(booking.id));
    } catch (error) {
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
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-field">
              <ArrowLeft color={themeColors.foreground} size={21} strokeWidth={2} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-title font-semibold text-foreground">Driver charges</Text>
              <Text className="font-sans text-caption text-secondary-foreground">{bookingId}</Text>
            </View>
          </View>

          {isLoading ? <ActivityIndicator className="mt-12" color={themeColors.primary} /> : null}
          {summary ? (
            <SettlementPaymentCard
              summary={summary}
              isProcessing={isProcessing}
              message={message}
              buttonLabel={approvalCompleted ? 'Retry payment confirmation' : checkout ? 'Continue with PayPal' : undefined}
              onPay={() => void pay()}
            />
          ) : !isLoading ? (
            <Text className="font-sans mt-section text-[13px] font-medium text-destructive">{message}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
