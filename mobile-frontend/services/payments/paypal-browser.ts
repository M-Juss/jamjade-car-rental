import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';

import { themeColors } from '@/constants/theme';
import { createPayPalCallbackUrls } from '@/lib/payments/paypal-callbacks';
import type { PayPalOrderResponse } from '@/services/api/types';

export type PayPalBrowserResult = 'approved' | 'cancelled' | 'interrupted';

let interruptActiveCheckout: (() => void) | null = null;

// Android Custom Tabs cannot be closed programmatically through Expo SDK 54.
// Own the callback/AppState subscriptions instead of the auth-session polyfill:
// its pending browser-close flag can survive a rejected browser launch.
export function openPayPalBrowser(
  order: PayPalOrderResponse,
  target: 'customer' | 'driver',
  signal: AbortSignal,
): Promise<PayPalBrowserResult> {
  if (signal.aborted) return Promise.resolve('interrupted');
  interruptActiveCheckout?.();

  const { returnUrl, cancelUrl } = createPayPalCallbackUrls(target);
  return new Promise((resolve, reject) => {
    let finished = false;
    let leftApp = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      clearTimeout(returnTimer);
      urlSubscription.remove();
      stateSubscription.remove();
      signal.removeEventListener('abort', interrupt);
      if (interruptActiveCheckout === interrupt) interruptActiveCheckout = null;
    };
    const finish = (result: PayPalBrowserResult) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };
    const interrupt = () => finish('interrupted');

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      try {
        const callback = new URL(url);
        const destination = `${callback.protocol}//${callback.host}${callback.pathname}`;
        // Ignore delayed callbacks from an older checkout, including cancellations.
        const tokens = callback.searchParams.getAll('token');
        if (tokens.length !== 1 || tokens[0] !== order.orderId) return;
        if (destination === returnUrl) finish('approved');
        if (destination === cancelUrl) finish('cancelled');
      } catch {
        // Unrelated or malformed deep links are not payment results.
      }
    });
    const stateSubscription = AppState.addEventListener('change', (state) => {
      clearTimeout(returnTimer);
      if (state !== 'active') {
        leftApp = true;
      } else if (leftApp) {
        // Android can deliver onResume before the payment deep link. Give the
        // matching callback a chance to arrive before treating this as a pause.
        returnTimer = setTimeout(interrupt, 500);
      }
    });

    interruptActiveCheckout = interrupt;
    signal.addEventListener('abort', interrupt, { once: true });

    void (async () => {
      const browsers = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
      if (finished) return;
      const result = await WebBrowser.openBrowserAsync(order.approvalUrl, {
        browserPackage: browsers.browserPackages.includes('com.android.chrome')
          ? 'com.android.chrome' : browsers.preferredBrowserPackage,
        createTask: false,
        showTitle: true,
        toolbarColor: themeColors.surface,
        enableDefaultShareMenuItem: false,
      });
      if (result.type !== 'opened') throw new Error('PayPal checkout could not open. Please try again.');
    })().catch(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('PayPal checkout could not open. Please try again.'));
    });
  });
}
