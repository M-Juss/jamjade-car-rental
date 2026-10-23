import { useLocalSearchParams } from 'expo-router';
import { firstParam } from '@/lib/browse/booking-params';
import { PaymentReceiptScreen } from '@/screens/payments/PaymentReceiptScreen';

export default function ReceiptRoute() {
  const params = useLocalSearchParams<{ receiptId?: string | string[]; bookingReference?: string | string[] }>();
  const id = Number(firstParam(params.receiptId));
  return <PaymentReceiptScreen receiptId={Number.isSafeInteger(id) && id > 0 ? id : undefined}
    bookingReference={firstParam(params.bookingReference)} />;
}
