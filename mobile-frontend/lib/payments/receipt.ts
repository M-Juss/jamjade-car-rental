import type { CustomerReceipt } from '@/services/api/types';

export function formatReceiptAmount(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

export function formatReceiptDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not provided';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(value));
}

export function receiptFilename(receipt: Pick<CustomerReceipt, 'bookingReference' | 'receiptReference'>) {
  return `${receipt.bookingReference}-Receipt-${receipt.receiptReference}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function receiptSuccessRoute(orderId: string, bookingReference: string) {
  return `/browse/success?status=success&orderId=${encodeURIComponent(orderId)}&reference=${encodeURIComponent(bookingReference)}` as const;
}
