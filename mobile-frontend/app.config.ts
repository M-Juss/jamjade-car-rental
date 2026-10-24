import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'JamJade Car Rental',
  slug: config.slug ?? 'jamjade-car-rental',
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
});
