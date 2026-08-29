import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, CreditCard } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatPeso } from '@/lib/bookings/helpers';
import { getPaymentErrorMessage } from '@/lib/payments/payment-error';
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
    void getDriverService(bookingId).then(setBooking).catch(() => setMessage('Driver charges could not be loaded.')).finally(() => setIsLoading(false));
  }, [bookingId]);

  const unpaidCharges = useMemo(
    () => booking?.additionalCharges.filter((charge) => charge.paymentStatus !== 'paid') ?? [],
    [booking],
  );
  const total = unpaidCharges.reduce((sum, charge) => sum + charge.amount, 0);

  const pay = async () => {
    if (!booking || isProcessing) return;
    setIsProcessing(true);
    setMessage(null);
    let orderId: string | null = null;
    let approved = false;

    try {
      const returnUrl = Linking.createURL('paypal/driver-return');
      const cancelUrl = Linking.createURL('paypal/driver-cancel');
      const order = await createDriverOutstandingPayPalOrder(booking.id, returnUrl, cancelUrl);
      orderId = order.orderId;
      const result = await WebBrowser.openAuthSessionAsync(order.approvalUrl, returnUrl);

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
    <SafeAreaView className="flex-1 bg-background px-5">
      <View className="flex-row items-center gap-3 py-3">
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface"><ArrowLeft color="#17315F" size={21} /></Pressable>
        <View><Text className="text-[24px] font-black text-foreground">Driver Balance</Text><Text className="text-[12px] font-bold text-muted-foreground">{bookingId}</Text></View>
      </View>

      {isLoading ? <ActivityIndicator className="mt-12" color="#346EF6" /> : null}
      {booking ? (
        <View className="mt-5 rounded-[28px] border border-border bg-surface p-5">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-muted"><CreditCard color="#346EF6" size={23} /></View>
          <Text className="mt-4 text-[11px] font-black uppercase text-subtle-foreground">Your unpaid charges</Text>
          {unpaidCharges.map((charge) => (
            <View key={charge.id} className="flex-row items-start justify-between gap-3 border-b border-[#EEF2FF] py-3">
              <View className="min-w-0 flex-1"><Text className="text-[13px] font-black text-foreground">{charge.typeLabel}</Text><Text className="mt-1 text-[11px] font-semibold text-muted-foreground">{charge.description}</Text></View>
              <Text className="text-[13px] font-black text-foreground">{formatPeso(charge.amount)}</Text>
            </View>
          ))}
          <View className="mt-4 flex-row justify-between"><Text className="text-[14px] font-black text-foreground">Outstanding</Text><Text className="text-[20px] font-black text-primary">{formatPeso(total)}</Text></View>
          {message ? <Text className="mt-4 text-[12px] font-bold leading-5 text-foreground">{message}</Text> : null}
          <Pressable disabled={isProcessing || total <= 0} onPress={() => void pay()} className="mt-5 min-h-[54px] items-center justify-center rounded-full bg-[#0070BA]">
            {isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-[14px] font-black text-surface">Pay {formatPeso(total)} with PayPal</Text>}
          </Pressable>
        </View>
      ) : !isLoading ? <Text className="mt-8 text-[13px] font-bold text-destructive">{message}</Text> : null}
    </SafeAreaView>
  );
}
