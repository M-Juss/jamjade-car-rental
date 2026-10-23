import { requireOptionalNativeModule } from 'expo';
import { PixelRatio, Platform, TurboModuleRegistry } from 'react-native';
import type { CustomerReceipt } from '@/services/api/types';
import { receiptFilename } from '@/lib/payments/receipt';
import { ReceiptSaveUnavailableError } from './errors';
import type { ReceiptImageTarget } from './types';

export async function saveReceiptJpeg(receipt: CustomerReceipt, target: ReceiptImageTarget) {
  if (!requireOptionalNativeModule('ExpoMediaLibrary') || !requireOptionalNativeModule('FileSystem')
    || !TurboModuleRegistry.get('RNViewShot')) {
    throw new ReceiptSaveUnavailableError('app_update_required');
  }
  const [{ Directory, File, Paths }, MediaLibrary, { captureRef, releaseCapture }] = await Promise.all([
    import('expo-file-system'), import('expo-media-library'), import('react-native-view-shot'),
  ]);
  if (!target.view.current || target.width <= 0 || target.height <= 0) {
    throw new Error('Receipt is not ready to save.');
  }
  let permission = await MediaLibrary.getPermissionsAsync(true, []);
  if (!permission.granted && permission.canAskAgain) {
    permission = await MediaLibrary.requestPermissionsAsync(true, []);
  }
  if (!permission.granted) {
    throw new ReceiptSaveUnavailableError(permission.canAskAgain ? 'permission_denied' : 'permission_blocked');
  }
  const directory = new Directory(Paths.cache, `receipt-${receipt.id}-${Date.now()}`);
  // iOS capture dimensions are points; Android accepts physical pixels.
  const scale = Platform.OS === 'ios' ? PixelRatio.get() : 1;
  let captured: string | undefined;
  try {
    captured = await captureRef(target.view, {
      format: 'jpg', quality: 0.95, result: 'tmpfile',
      width: 1080 / scale, height: Math.round(1080 * target.height / target.width) / scale,
    });
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, receiptFilename(receipt));
    new File(captured).copy(file);
    await MediaLibrary.saveToLibraryAsync(file.uri);
    return 'gallery' as const;
  } finally {
    try {
      if (directory.exists) directory.delete();
    } finally {
      if (captured) releaseCapture(captured);
    }
  }
}
