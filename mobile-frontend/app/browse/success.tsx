import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AlertCircle, CheckCircle2, CreditCard } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { firstParam } from '@/lib/browse/booking-params';
import { formatPeso } from '@/lib/browse/pricing';
import { capturePayPalOrder } from '@/services/api';

export default function PaymentResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    status?: string | string[];
    source?: string | string[];
    reference?: string | string[];
    paymentStatus?: string | string[];
    remainingBalance?: string | string[];
    balanceDueAt?: string | string[];
    message?: string | string[];
    orderId?: string | string[];
    retryPath?: string | string[];
  }>();
  const isSuccess = firstParam(params.status) === 'success';
  const reference = firstParam(params.reference);
  const paymentStatus = firstParam(params.paymentStatus);
  const remainingBalance = Number(firstParam(params.remainingBalance) ?? 0);
  const balanceDueAt = firstParam(params.balanceDueAt);
  const message = firstParam(params.message);
  const orderId = firstParam(params.orderId);
  const retryPath = firstParam(params.retryPath);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace('/(tabs)/bookings' as Href);
    }, 3500);

    return () => clearTimeout(timer);
  }, [isSuccess, router]);

  const retry = async () => {
    if (!orderId) {
      router.replace((retryPath || '/(tabs)/bookings') as Href);
      return;
    }

    setIsRetrying(true);

    try {
      const booking = await capturePayPalOrder(orderId);
      router.replace(
        `/browse/success?status=success&source=${encodeURIComponent(firstParam(params.source) ?? 'booking')}&reference=${encodeURIComponent(booking.bookingCode)}&paymentStatus=${encodeURIComponent(booking.paymentStatus)}&remainingBalance=${encodeURIComponent(String(booking.remainingBalance))}&balanceDueAt=${encodeURIComponent(booking.balanceDueAt ?? '')}` as Href,
      );
    } catch {
      setIsRetrying(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <View className="flex-1 justify-center px-5 py-8">
        <View className="rounded-[34px] border border-[#DDE8FF] bg-white px-5 py-8 shadow-xl shadow-[#17315F]/8">
          <View
            className={`h-20 w-20 items-center justify-center self-center rounded-full ${
              isSuccess ? 'bg-[#EAFBF2]' : 'bg-[#FEF2F2]'
            }`}>
            {isSuccess ? (
              <CheckCircle2 size={43} color="#159947" strokeWidth={2.5} />
            ) : (
              <AlertCircle size={43} color="#DC2626" strokeWidth={2.5} />
            )}
          </View>

          <Text className="mt-5 text-center text-[29px] font-black text-[#17315F]">
            {isSuccess ? 'Payment Successful' : 'Payment Unsuccessful'}
          </Text>
          <Text className="mt-3 text-center text-[14px] font-semibold leading-6 text-[#6C7A96]">
            {isSuccess
              ? 'Thank you for using PayPal. Your payment and booking records have been updated.'
              : message ?? 'The payment was not completed. No new payment was recorded.'}
          </Text>

          {isSuccess ? (
            <View className="mt-6 rounded-[26px] bg-[#F8FAFF] p-5">
              <Text className="text-[12px] font-black uppercase text-[#91A0B8]">Booking Reference</Text>
              <Text className="mt-1 text-[19px] font-black text-[#17315F]">{reference}</Text>
              <Text className="mt-4 text-[12px] font-black uppercase text-[#91A0B8]">Payment Status</Text>
              <Text className="mt-1 text-[16px] font-black text-[#159947]">{paymentStatus}</Text>
              {remainingBalance > 0 ? (
                <>
                  <Text className="mt-4 text-[12px] font-black uppercase text-[#91A0B8]">
                    Remaining Balance
                  </Text>
                  <Text className="mt-1 text-[20px] font-black text-[#DC7A00]">
                    {formatPeso(remainingBalance)}
                  </Text>
                  <Text className="mt-2 text-[12px] font-bold leading-5 text-[#9A5B00]">
                    Due {balanceDueAt ? new Date(balanceDueAt).toLocaleString() : 'before the payment deadline'}.
                    If unpaid, the booking will be cancelled and the down payment is non-refundable.
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isRetrying}
            onPress={() => isSuccess ? router.replace('/(tabs)/bookings' as Href) : void retry()}
            className={`mt-7 min-h-[60px] flex-row items-center justify-center gap-2 rounded-full ${
              isSuccess ? 'bg-[#346EF6]' : 'bg-[#0070BA]'
            }`}>
            {isRetrying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                {!isSuccess ? <CreditCard size={19} color="#FFFFFF" strokeWidth={2.5} /> : null}
                <Text className="text-[16px] font-black text-white">
                  {isSuccess ? 'View My Bookings' : orderId ? 'Retry Payment Confirmation' : 'Try Again'}
                </Text>
              </>
            )}
          </Pressable>
          {!isSuccess && orderId && retryPath ? (
            <Pressable
              accessibilityRole="button"
              disabled={isRetrying}
              onPress={() => router.replace(retryPath as Href)}
              className="mt-3 min-h-[54px] items-center justify-center rounded-full border border-[#C8D4E8] bg-white">
              <Text className="text-[15px] font-black text-[#17315F]">Restart Payment</Text>
            </Pressable>
          ) : null}
          {isSuccess ? (
            <Text className="mt-3 text-center text-[11px] font-semibold text-[#91A0B8]">
              Redirecting to your Booking tab...
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
