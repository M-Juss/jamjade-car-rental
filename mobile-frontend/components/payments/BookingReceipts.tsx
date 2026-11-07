import { ChevronRight, ReceiptText } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { SectionCard } from '@/components/bookings/SectionCard';
import { themeColors } from '@/constants/theme';
import { formatReceiptAmount, formatReceiptDate } from '@/lib/payments/receipt';
import { getBookingReceipts, type CustomerReceiptPage } from '@/services/api';

export function BookingReceipts({ bookingReference }: { bookingReference: string }) {
  const router = useRouter();
  const [result, setResult] = useState<CustomerReceiptPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [request, setRequest] = useState({ page: 1, retry: 0 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void getBookingReceipts(bookingReference, request.page).then((data) => {
      if (active) setResult((previous) => ({
        ...data,
        receipts: request.page === 1 ? data.receipts : [
          ...(previous?.receipts ?? []), ...data.receipts,
        ].filter((receipt, index, receipts) => receipts.findIndex((item) => item.id === receipt.id) === index),
      }));
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingReference, request]);

  return (
    <SectionCard title="Receipts" icon={ReceiptText}>
      {result?.receipts.map((receipt) => (
        <Pressable key={receipt.id} accessibilityRole="button" accessibilityLabel={`View ${receipt.receiptReference}, ${formatReceiptAmount(receipt.amount)}`}
          onPress={() => router.push({ pathname: '/bookings/receipt', params: { receiptId: String(receipt.id), bookingReference } })}
          className="min-h-control flex-row items-center gap-3 border-b border-border py-3">
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-body font-semibold text-foreground">{receipt.receiptReference}</Text>
            <Text className="font-sans mt-1 text-caption text-foreground">{receipt.purpose}</Text>
            <Text className="font-sans mt-0.5 text-caption text-secondary-foreground">{formatReceiptDate(receipt.paidAt)}</Text>
          </View>
          <Text className="font-sans text-body font-semibold text-foreground">{formatReceiptAmount(receipt.amount)}</Text>
          <ChevronRight accessible={false} size={18} color={themeColors.primary} />
        </Pressable>
      ))}
      {loading ? <ActivityIndicator accessibilityLabel="Loading receipts" className="my-3" color={themeColors.primary} /> : null}
      {!loading && error ? (
        <View className="gap-2">
          <Text accessibilityRole="alert" className="font-sans text-caption text-secondary-foreground">Receipts could not be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={() => setRequest((current) => ({ ...current, retry: current.retry + 1 }))} className="min-h-control justify-center">
            <Text className="font-sans text-body font-semibold text-primary">Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !error && result?.receipts.length === 0 ? <Text className="font-sans text-body text-secondary-foreground">No receipts issued yet.</Text> : null}
      {!loading && !error && result && result.page < result.lastPage ? (
        <Pressable accessibilityRole="button" onPress={() => setRequest({ page: result.page + 1, retry: 0 })} className="min-h-control justify-center">
          <Text className="font-sans text-body font-semibold text-primary">More receipts</Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}
