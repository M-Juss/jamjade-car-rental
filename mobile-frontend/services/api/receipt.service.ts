import { apiDownload, apiGet } from '@/services/http';
import type { CustomerReceipt, CustomerReceiptPage } from './types';

export async function getReceipt(receiptId: number) {
  const response = await apiGet<CustomerReceipt>(`/mobile/receipts/${receiptId}`);
  return response.data;
}

export async function getOrderReceipt(orderId: string) {
  const response = await apiGet<CustomerReceipt>(`/mobile/paypal/orders/${encodeURIComponent(orderId)}/receipt`);
  return response.data;
}

export async function getBookingReceipts(bookingReference: string, page = 1): Promise<CustomerReceiptPage> {
  const response = await apiGet<CustomerReceipt[]>(
    `/mobile/bookings/${encodeURIComponent(bookingReference)}/receipts?page=${page}`,
  );
  return {
    receipts: response.data,
    page: Number(response.meta?.current_page ?? page),
    lastPage: Number(response.meta?.last_page ?? page),
  };
}

export function downloadReceipt(receiptId: number) {
  return apiDownload(`/mobile/receipts/${receiptId}/download`);
}
