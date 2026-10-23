import { themeColors } from '@/constants/theme';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AlertCircle, CreditCard } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { firstParam } from '@/lib/browse/booking-params';
import { receiptSuccessRoute } from '@/lib/payments/receipt';
import { capturePayPalOrder } from '@/services/api';
import { PaymentReceiptScreen } from '@/screens/payments/PaymentReceiptScreen';

function PaymentFailureScreen({ orderId, message, retryPath }: {
  orderId?: string; message?: string; retryPath?: string;
}) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const retry = async () => {
    if (isRetrying) return;
    if (!orderId) {
      router.replace((retryPath || '/(tabs)/bookings') as Href);
      return;
    }
    setIsRetrying(true);
    setRetryError(null);
    try {
      const booking = await capturePayPalOrder(orderId);
      router.replace(receiptSuccessRoute(orderId, booking.bookingCode) as Href);
    } catch {
      setRetryError('Payment confirmation is unavailable. Try again or check your booking before starting another payment.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-5 py-8">
        <View className="rounded-card border border-border bg-surface px-5 py-8">
          <View className="h-20 w-20 items-center justify-center self-center rounded-full bg-destructive-surface">
            <AlertCircle size={43} color={themeColors.destructive} strokeWidth={2.5} />
          </View>
          <Text className="font-sans mt-5 text-center text-title font-semibold text-foreground">
            {orderId ? 'Confirm payment' : 'Payment unsuccessful'}
          </Text>
          <Text accessibilityRole="alert" className="font-sans mt-3 text-center text-body leading-6 text-secondary-foreground">
            {retryError || message || (orderId ? 'The payment result could not be confirmed. Check its status before paying again.' : 'The payment was not completed.')}
          </Text>
          <Pressable accessibilityRole="button" disabled={isRetrying} onPress={() => void retry()}
            className="mt-7 min-h-control flex-row items-center justify-center gap-2 rounded-full bg-primary">
            {isRetrying ? <ActivityIndicator color={themeColors.surface} /> : (
              <>
                <CreditCard size={19} color={themeColors.surface} strokeWidth={2.5} />
                <Text className="font-sans text-button font-medium text-surface">{orderId ? 'Retry payment confirmation' : 'Try again'}</Text>
              </>
            )}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isRetrying} onPress={() => router.replace('/(tabs)/bookings')}
            className="mt-3 min-h-control items-center justify-center rounded-full border border-border bg-surface">
            <Text className="font-sans text-button font-medium text-foreground">View bookings</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function ProtectedPaymentResultScreen() {
  const params = useLocalSearchParams<{
    status?: string | string[]; reference?: string | string[]; message?: string | string[];
    orderId?: string | string[]; retryPath?: string | string[];
  }>();
  return (
    <AuthenticatedOnly>
      {firstParam(params.status) === 'success' ? (
        <PaymentReceiptScreen orderId={firstParam(params.orderId)} bookingReference={firstParam(params.reference)} />
      ) : (
        <PaymentFailureScreen orderId={firstParam(params.orderId)} message={firstParam(params.message)} retryPath={firstParam(params.retryPath)} />
      )}
    </AuthenticatedOnly>
  );
}
