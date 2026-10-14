import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function createPayPalCallbackUrls(target: 'customer' | 'driver' = 'customer') {
  const createCallback = (path: string) => {
    if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
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
    // Android's WebBrowser session matches URLs by prefix. Both approval and
    // cancellation must resolve the session before the app resumes.
    sessionReturnUrl: Platform.OS === 'web' ? returnUrl : createCallback(prefix).split('?')[0],
  };
}
