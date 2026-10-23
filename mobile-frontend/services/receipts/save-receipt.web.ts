import type { CustomerReceipt } from '@/services/api/types';
import { receiptFilename } from '@/lib/payments/receipt';
import { themeColors } from '@/constants/theme';
import type { ReceiptImageTarget } from './types';

export async function saveReceiptJpeg(receipt: CustomerReceipt, target: ReceiptImageTarget) {
  const element = target.view.current as unknown as HTMLElement | null;
  if (!element || target.width <= 0 || target.height <= 0) throw new Error('Receipt is not ready to save.');
  await document.fonts.ready;
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: themeColors.background, scale: 1080 / target.width,
    logging: false,
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((image) => image ? resolve(image) : reject(new Error('Receipt image could not be created.')), 'image/jpeg', 0.95);
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = receiptFilename(receipt);
    document.body.appendChild(link);
    link.click();
    return 'download' as const;
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
