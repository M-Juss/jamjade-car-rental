import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';

export function createPayPalCallbackUrls(target: 'customer' | 'driver' = 'customer') {
  const createCallback = (path: string) => {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return Linking.createURL(`/${path}`);
    }

    // Installed builds use the scheme registered in app.json, without the
    // development server's host/port leaking into the payment return URL.
    return `mobilefrontend://${path}`;
  };

  const prefix = `paypal/${target === 'driver' ? 'driver-' : ''}`;
  const returnUrl = createCallback(`${prefix}return`);

  return {
    returnUrl,
    cancelUrl: createCallback(`${prefix}cancel`),
  };
}
