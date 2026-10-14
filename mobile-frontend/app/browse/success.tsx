import { themeColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AlertCircle, CheckCircle2, CreditCard } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { firstParam } from '@/lib/browse/booking-params';
import { formatPeso } from '@/lib/browse/pricing';
import { getSettlementSummary } from '@/lib/payments/settlement-summary';
import { useAuth } from '@/providers/AuthProvider';
import { capturePayPalOrder, getBooking } from '@/services/api';
import type { Booking } from '@/types/booking';

function PaymentResultScreen() {
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
  const [settledBooking, setSettledBooking] = useState<Booking | null>(null);
  const remainingBalance = settledBooking?.remainingBalance ?? Number(firstParam(params.remainingBalance) ?? 0);
  const summary = settledBooking ? getSettlementSummary(settledBooking) : null;
  const message = firstParam(params.message);
  const orderId = firstParam(params.orderId);
  const retryPath = firstParam(params.retryPath);
  const [isRetrying, setIsRetrying] = useState(false);
  const { refreshProfile } = useAuth();

  useEffect(() => {
    if (!isSuccess || !reference) return;
    let isActive = true;
    void getBooking(reference).then((booking) => {
      if (isActive) setSettledBooking(booking);
    }).catch(() => undefined);
    return () => { isActive = false; };
  }, [isSuccess, reference]);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    void refreshProfile().catch(() => undefined);

    const timer = setTimeout(() => {
      router.replace('/(tabs)/bookings' as Href);
    }, 3500);

    return () => clearTimeout(timer);
  }, [isSuccess, refreshProfile, router]);

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
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-5 py-8">
        <View className="rounded-[34px] border border-border bg-surface px-5 py-8 ">
          <View
            className={`h-20 w-20 items-center justify-center self-center rounded-full ${
              isSuccess ? 'bg-[#EAFBF2]' : 'bg-destructive-surface'
            }`}>
            {isSuccess ? (
              <CheckCircle2 size={43} color={themeColors.success} strokeWidth={2.5} />
            ) : (
              <AlertCircle size={43} color={themeColors.destructive} strokeWidth={2.5} />
            )}
          </View>

          <Text className="font-sans mt-5 text-center text-title font-semibold text-foreground">
            {isSuccess ? 'Payment Successful' : 'Payment Unsuccessful'}
          </Text>
          <Text className="font-sans mt-3 text-center text-[14px] font-normal leading-6 text-secondary-foreground">
            {isSuccess
              ? 'Thank you for using PayPal. Your payment and booking records have been updated.'
              : (message ?? 'The payment was not completed. No new payment was recorded.')}
          </Text>

          {isSuccess ? (
            <View className="mt-5 rounded-card bg-background p-5">
              <Text className="font-sans text-[12px] font-normal text-secondary-foreground">
                Booking Reference
              </Text>
              <Text className="font-sans mt-1 text-[19px] font-semibold text-foreground">{reference}</Text>
              <Text className="font-sans mt-4 text-[12px] font-normal text-secondary-foreground">
                Payment Status
              </Text>
              <Text className="font-sans mt-1 text-[16px] font-semibold text-success">{paymentStatus}</Text>
              {remainingBalance > 0 ? (
                <>
                  <Text className="font-sans mt-4 text-[12px] font-normal text-secondary-foreground">
                    Remaining Balance
                  </Text>
                  <Text className="font-sans mt-1 text-[20px] font-semibold text-warning">
                    {formatPeso(remainingBalance)}
                  </Text>
                  {summary?.deadline ? (
                    <Text className="font-sans mt-2 text-[12px] font-medium leading-5 text-warning">
                      Due {new Date(summary.deadline).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}.
                      If unpaid, the booking will be cancelled and the down payment is non-refundable.
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isRetrying}
            onPress={() => (isSuccess ? router.replace('/(tabs)/bookings' as Href) : void retry())}
            className={`mt-7 min-h-control flex-row items-center justify-center gap-2 rounded-full ${
              isSuccess ? 'bg-primary' : 'bg-[#0070BA]'
            }`}>
            {isRetrying ? (
              <ActivityIndicator color={themeColors.surface} />
            ) : (
              <>
                {!isSuccess ? <CreditCard size={19} color={themeColors.surface} strokeWidth={2.5} /> : null}
                <Text className="font-sans text-button font-medium text-surface">
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
              className="mt-3 min-h-[54px] items-center justify-center rounded-full border border-[#C8D4E8] bg-surface">
              <Text className="font-sans text-[15px] font-semibold text-foreground">Restart Payment</Text>
            </Pressable>
          ) : null}
          {isSuccess ? (
            <Text className="font-sans mt-3 text-center text-[11px] font-normal text-secondary-foreground">
              Redirecting to your Booking tab...
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function ProtectedPaymentResultScreen() {
  return (
    <AuthenticatedOnly>
      <PaymentResultScreen />
    </AuthenticatedOnly>
  );
}
