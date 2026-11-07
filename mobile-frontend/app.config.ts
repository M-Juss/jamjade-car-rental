import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'JamJade Car Rental',
  slug: config.slug ?? 'jamjade-car-rental',
  plugins: [
    ...(config.plugins ?? []),
    ['./plugins/withBackendDnsFallback', {
      apiUrls: [
        process.env.EXPO_PUBLIC_BACKEND_API ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? process.env.EXPO_PUBLIC_API_URL,
        process.env.EXPO_PUBLIC_BACKEND_TUNNEL_API ?? process.env.EXPO_PUBLIC_BACKEND_FALLBACK_API,
      ].filter(Boolean),
    }],
  ],
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
