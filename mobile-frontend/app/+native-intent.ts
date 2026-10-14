const paymentCallbacks = new Set([
  'paypal/return',
  'paypal/cancel',
  'paypal/driver-return',
  'paypal/driver-cancel',
]);

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'mobilefrontend://app');

    if (!['mobilefrontend:', 'exp:', 'exps:'].includes(url.protocol)) {
      return path;
    }

    const callbackPath = url.protocol === 'mobilefrontend:' && url.hostname === 'paypal'
      ? `paypal${url.pathname}`
      : url.pathname.replace(/^\/--\//, '/');

    if (paymentCallbacks.has(callbackPath.replace(/^\/+|\/+$/g, ''))) {
      // WebBrowser's pending session consumes the original URL and the payment
      // screen confirms it. Do not also navigate to a nonexistent callback page.
      // A cold launch has no pending checkout in memory; open the app normally.
      return initial ? '/' : '';
    }
  } catch {
    return path;
  }

  return path;
}
