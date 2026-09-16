import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import {
  useLocalSearchParams,
  useRootNavigationState,
  useRouter,
  type Href,
} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingStepper, ErrorState, SelectedVehicleSummary, browseIcons } from '@/components/browse';
import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import { getBookingFlow, resetBookingFlow } from '@/lib/browse/booking-flow';
import {
  canUseDownPayment,
  DOWN_PAYMENT_MINIMUM_LEAD_DAYS,
} from '@/lib/browse/payment-options';
import { formatPeso } from '@/lib/browse/pricing';
import { TERMS_VERSION } from '@/lib/browse/rental-config';
import { getPaymentErrorMessage } from '@/lib/payments/payment-error';
import {
  abandonPayPalOrder,
  capturePayPalOrder,
  createPayPalOrder,
  type PayPalOrderResponse,
} from '@/services/api';

type PaymentSelection = 'down_payment' | 'full_payment';

WebBrowser.maybeCompleteAuthSession();

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function PaymentChoiceCard({
  amount,
  description,
  isSelected,
  onPress,
  title,
}: {
  title: string;
  description: string;
  amount: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={cx(
        'rounded-[26px] border p-5',
        isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
      )}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="text-[17px] font-black text-foreground">{title}</Text>
          <Text className="mt-2 text-[13px] font-semibold leading-5 text-muted-foreground">{description}</Text>
        </View>
        <View className={cx('h-8 w-8 items-center justify-center rounded-full border', isSelected ? 'border-primary bg-primary' : 'border-[#C8D4E8] bg-surface')}>
          {isSelected && <browseIcons.Check size={17} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </View>
      <Text className="mt-4 text-[24px] font-black text-primary">{amount}</Text>
    </Pressable>
  );
}

function PaymentScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const params = useLocalSearchParams<{
    flow?: string | string[];
    vehicleId?: string | string[];
  }>();
  const flowId = firstParam(params.flow);
  const routeVehicleId = firstParam(params.vehicleId);
  const flow = getBookingFlow(flowId);
  const customerSignature = flow?.stage === 'payment' ? flow.signature : null;
  const booking = flow?.stage === 'payment' && customerSignature ? flow.booking : null;
  const isDownPaymentAvailable = booking ? canUseDownPayment(booking.rentalDate) : false;
  const selectedVehicleId = booking?.vehicleId ?? routeVehicleId;
  const { vehicle, isLoading, error, reload } = useVehicle(selectedVehicleId);
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>(
    isDownPaymentAvailable ? 'down_payment' : 'full_payment',
  );
  const [checkout, setCheckout] = useState<PayPalOrderResponse | null>(null);
  const [approvalCompleted, setApprovalCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useFormToast();

  useEffect(() => {
    if (!isDownPaymentAvailable && paymentSelection !== 'full_payment') {
      setPaymentSelection('full_payment');
    }
  }, [isDownPaymentAvailable, paymentSelection]);

  const restartBooking = useCallback(() => {
    resetBookingFlow(flowId);

    if (routeVehicleId) {
      router.replace(`/browse/booking?vehicleId=${encodeURIComponent(routeVehicleId)}` as Href);
      return;
    }

    router.replace('/' as Href);
  }, [flowId, routeVehicleId, router]);

  useFocusEffect(
    useCallback(() => {
      if (!rootNavigationState?.key) {
        return;
      }

      const currentFlow = getBookingFlow(flowId);

      if (!currentFlow || currentFlow.stage !== 'payment' || !currentFlow.signature) {
        const redirectTimer = setTimeout(restartBooking, 0);

        return () => clearTimeout(redirectTimer);
      }

      return undefined;
    }, [flowId, restartBooking, rootNavigationState?.key]),
  );

  if (booking && isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  if (!booking || !customerSignature) {
    return (
      <ErrorState
        onAction={restartBooking}
        title="Payment flow reset"
        subtitle="Signed Terms and Conditions are required before choosing payment."
      />
    );
  }

  if (!vehicle) {
    return (
      <ErrorState
        actionLabel={error ? 'Try Again' : 'Restart Booking'}
        title="Vehicle unavailable"
        subtitle={error ?? 'The selected vehicle could not be loaded.'}
        onAction={() => error ? void reload() : restartBooking()}
      />
    );
  }

  const captureCheckout = async (order: PayPalOrderResponse) => {
    const capturedBooking = await capturePayPalOrder(order.orderId);

    resetBookingFlow(flowId);
    router.replace(
      `/browse/success?status=success&source=booking&reference=${encodeURIComponent(capturedBooking.bookingCode)}&paymentStatus=${encodeURIComponent(capturedBooking.paymentStatus)}&remainingBalance=${encodeURIComponent(String(capturedBooking.remainingBalance))}&balanceDueAt=${encodeURIComponent(capturedBooking.balanceDueAt ?? '')}` as Href,
    );
  };

  const handlePayPalCheckout = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    let approved = approvalCompleted;
    let activeOrder = checkout;

    try {
      if (approvalCompleted && checkout) {
        await captureCheckout(checkout);
        return;
      }

      const redirectUrl = Linking.createURL('paypal/return');
      const cancelUrl = Linking.createURL('paypal/cancel');
      const order = activeOrder ?? await createPayPalOrder({
        vehicleId: booking.vehicleId,
        rentalStartAt: booking.rentalStartAt,
        rentalEndAt: booking.rentalEndAt,
        pickupLocationType: booking.pickupOption,
        pickupLocation: booking.pickupLocation,
        returnLocation: booking.returnLocation,
        driverOption: booking.driverOption,
        ownerDriverCoverage: booking.ownerDriverCoverage,
        paymentOption: paymentSelection,
        customerSignature,
        termsVersion: TERMS_VERSION,
        appReturnUrl: redirectUrl,
        appCancelUrl: cancelUrl,
      });
      activeOrder = order;

      if (!checkout) {
        setCheckout(order);
      }

      const result = await WebBrowser.openAuthSessionAsync(order.approvalUrl, redirectUrl);

      if (result.type !== 'success') {
        approved = true;

        try {
          await captureCheckout(order);
          return;
        } catch {
          router.replace(
            `/browse/success?status=failed&message=${encodeURIComponent('The PayPal window closed before the app received confirmation. If PayPal showed “Thanks for using PayPal”, confirm the payment below.')}&orderId=${encodeURIComponent(order.orderId)}&retryPath=${encodeURIComponent(`/browse/payment?flow=${flowId ?? ''}&vehicleId=${routeVehicleId ?? ''}`)}` as Href,
          );
          return;
        }
      }

      const redirect = Linking.parse(result.url);

      if (redirect.path?.includes('cancel') || result.url.includes('/cancel')) {
        await abandonPayPalOrder(order.orderId);
        router.replace(
          `/browse/success?status=failed&message=${encodeURIComponent('PayPal payment was cancelled.')}&retryPath=${encodeURIComponent(`/browse/payment?flow=${flowId ?? ''}&vehicleId=${routeVehicleId ?? ''}`)}` as Href,
        );
        return;
      }

      const returnedOrderId = redirect.queryParams?.token;

      if (typeof returnedOrderId === 'string' && returnedOrderId !== order.orderId) {
        throw new Error('PayPal returned a different order reference.');
      }

      setApprovalCompleted(true);
      approved = true;
      await captureCheckout(order);
    } catch (checkoutError) {
      const message = getPaymentErrorMessage(checkoutError, 'PayPal checkout failed. Please try again.');

      if (activeOrder && !approved) {
        await abandonPayPalOrder(activeOrder.orderId).catch(() => undefined);
      }

      router.replace(
        `/browse/success?status=failed&message=${encodeURIComponent(message)}${approved && activeOrder ? `&orderId=${encodeURIComponent(activeOrder.orderId)}` : ''}&retryPath=${encodeURIComponent(`/browse/payment?flow=${flowId ?? ''}&vehicleId=${routeVehicleId ?? ''}`)}` as Href,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedAmount = paymentSelection === 'full_payment'
    ? booking.totalAmount
    : booking.downPaymentAmount;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Restart booking"
              accessibilityRole="button"
              onPress={restartBooking}
              className="h-12 w-12 items-center justify-center rounded-full bg-surface">
              <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[27px] font-black text-foreground">Payment</Text>
              <Text className="mt-1 text-[13px] font-semibold text-muted-foreground">Choose your payment amount</Text>
            </View>
          </View>

          <View className="mt-5">
            <BookingStepper step={3} />
          </View>

          <View className="mt-6">
            <SelectedVehicleSummary vehicle={vehicle} />
          </View>

          <View className="mt-6 gap-3">
            {isDownPaymentAvailable ? (
              <PaymentChoiceCard
                title="Down Payment"
                description="Pay 50% of the full cost first."
                amount={formatPeso(booking.downPaymentAmount)}
                isSelected={paymentSelection === 'down_payment'}
                onPress={() => {
                  if (checkout) {
                    toast.showToast('A PayPal order is already open. Complete it or restart the booking.');
                    return;
                  }

                  setPaymentSelection('down_payment');
                }}
              />
            ) : (
              <Text className="rounded-[22px] border border-border bg-muted px-4 py-3 text-[12px] font-semibold leading-5 text-[#536888]">
                Full payment is required because the rental starts in less than {DOWN_PAYMENT_MINIMUM_LEAD_DAYS} days. The down-payment option appears when the rental date is at least {DOWN_PAYMENT_MINIMUM_LEAD_DAYS} days from today.
              </Text>
            )}
            <PaymentChoiceCard
              title="Full Payment"
              description="Pay the full booking cost."
              amount={formatPeso(booking.totalAmount)}
              isSelected={paymentSelection === 'full_payment'}
              onPress={() => {
                if (checkout) {
                  toast.showToast('A PayPal order is already open. Complete it or restart the booking.');
                  return;
                }

                setPaymentSelection('full_payment');
              }}
            />
          </View>

          <View className="mt-6 rounded-[30px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1">
                <Text className="text-[18px] font-black text-foreground">PayPal Sandbox</Text>
                <Text className="mt-2 text-[13px] font-semibold leading-5 text-muted-foreground">
                  You will sign in to PayPal and approve the payment securely.
                </Text>
              </View>
              <View className="rounded-full bg-[#FFF4D8] px-3 py-2">
                <Text className="text-[12px] font-black text-foreground">PHP</Text>
              </View>
            </View>

            <View className="my-5 h-px bg-border" />

            <View className="flex-row items-center justify-between gap-4">
              <Text className="text-[13px] font-bold text-muted-foreground">Amount to pay</Text>
              <Text className="text-[23px] font-black text-foreground">
                {formatPeso(checkout?.amount ?? selectedAmount)}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={() => void handlePayPalCheckout()}
              className={cx(
                'mt-5 min-h-[60px] flex-row items-center justify-center gap-3 rounded-full bg-[#0070BA]',
                isProcessing && 'opacity-65',
              )}>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[16px] font-black text-surface">
                  {approvalCompleted ? 'Retry Payment Confirmation' : 'Continue with PayPal'}
                </Text>
              )}
            </Pressable>

            <Text className="mt-3 text-center text-[11px] font-semibold leading-4 text-subtle-foreground">
              PayPal credentials stay on the JamJade backend. All checkout orders use Philippine pesos.
            </Text>
          </View>
        </View>
      </ScrollView>
      <FormToast
        message={toast.message}
        onDismiss={toast.clearToast}
        title={toast.title}
        variant={toast.variant}
      />
    </SafeAreaView>
  );
}

export default function ProtectedPaymentScreen() {
  return (
    <AuthenticatedOnly>
      <PaymentScreen />
    </AuthenticatedOnly>
  );
}
