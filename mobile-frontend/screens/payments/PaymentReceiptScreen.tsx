import { useRouter } from 'expo-router';
import { ArrowLeft, ReceiptText } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { getOrderReceipt, getReceipt, type CustomerReceipt } from '@/services/api';
import { ApiError } from '@/services/http';
import { saveReceiptJpeg } from '@/services/receipts/save-receipt';
import { ReceiptSaveUnavailableError } from '@/services/receipts/errors';
import { useAuth } from '@/providers/AuthProvider';

export function PaymentReceiptScreen({ receiptId, orderId, bookingReference }: {
  receiptId?: number;
  orderId?: string;
  bookingReference?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const [receipt, setReceipt] = useState<CustomerReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const receiptView = useRef<View>(null);
  const receiptSize = useRef({ width: 0, height: 0 });
  const toast = useFormToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReceipt(null);
    setError(null);
    const load = receiptId ? getReceipt(receiptId) : orderId ? getOrderReceipt(orderId) : null;
    if (!load) {
      setLoading(false);
      setError('Receipt reference is missing. Open your booking to view its receipts.');
      return;
    }
    void load.then((data) => {
      if (active) setReceipt(data);
    }).catch((failure) => {
      if (active) setError(failure instanceof ApiError && failure.status === 409
        ? 'Payment received. Your receipt is being prepared. Try again shortly.'
        : 'The receipt could not be loaded. Try again or open your booking to check the payment.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [receiptId, orderId, retryKey]);

  useEffect(() => {
    if (receipt) void refreshProfile().catch(() => undefined);
  }, [receipt, refreshProfile]);

  const viewBooking = useCallback(() => {
    const reference = receipt?.bookingReference || bookingReference;
    if (reference) {
      router.replace({ pathname: '/bookings/[id]', params: { id: reference } });
    } else {
      router.replace('/(tabs)/bookings');
    }
  }, [receipt, bookingReference, router]);

  const download = async () => {
    if (!receipt || downloading) return;
    setDownloading(true);
    try {
      const destination = await saveReceiptJpeg(receipt, { view: receiptView, ...receiptSize.current });
      toast.showToast(destination === 'gallery' ? 'Receipt saved to gallery.' : 'Receipt downloaded.', 'success', 'Receipt saved');
    } catch (failure) {
      toast.showToast(failure instanceof ReceiptSaveUnavailableError ? failure.message
        : 'The receipt could not be saved. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[560px] self-center px-screen pb-3" style={{ paddingTop: insets.top + 10 }}>
          <View className="mb-3 min-h-12 flex-row items-center gap-3">
            <Pressable accessibilityRole="button" accessibilityLabel="Back to booking" onPress={viewBooking}
              className="h-11 w-11 items-center justify-center rounded-field border border-border bg-surface">
              <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.45} />
            </Pressable>
            <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-title font-semibold text-foreground">Payment receipt</Text>
          </View>
          {loading ? (
            <View className="items-center py-16"><ActivityIndicator accessibilityLabel="Loading receipt" color={themeColors.primary} size="large" /></View>
          ) : receipt ? (
            <View ref={receiptView} collapsable={false} className="-mx-screen bg-background px-screen py-3"
              onLayout={({ nativeEvent }) => { receiptSize.current = nativeEvent.layout; }}>
              <PaymentReceipt receipt={receipt} />
            </View>
          ) : (
            <View className="items-center rounded-card border border-border bg-surface p-card">
              <ReceiptText size={40} color={themeColors.primary} />
              <Text accessibilityRole="alert" className="font-sans mt-4 text-center text-body text-secondary-foreground">{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomActionButton
        layout="inline"
        label="View booking"
        onPress={viewBooking}
        disabled={downloading}
        secondaryLabel={receipt ? (downloading ? 'Saving...' : 'Save receipt') : loading ? undefined : 'Try again'}
        onSecondaryPress={receipt ? () => void download() : () => setRetryKey((value) => value + 1)}
      />
      <FormToast message={toast.message} onDismiss={toast.clearToast} title={toast.title} variant={toast.variant} />
    </View>
  );
}
