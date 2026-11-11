import type { ImageSourcePropType } from 'react-native';

// Match the original upload, not the vehicle/model, so replacement photos stay current.
const transparentVehicleImages: Record<string, ImageSourcePropType> = {
  'UDEO7laaeVUfknxJp8NpRbBICIpYay8zSyWT3alt.jpg': require('../../assets/images/vehicles/toyota-vios-red.png'),
  '44Uk0Cq0cGPjXmtZBNMQ58e6IzANtaugZ7pkQQmD.jpg': require('../../assets/images/vehicles/honda-brv-2020.png'),
  'JneuHefkuFQfyDuBYIO05nbp0pFqd8gejYfo9YpA.jpg': require('../../assets/images/vehicles/toyota-avanza-2022.png'),
  'Z5P2AorYIAMFLngtJQSFBpLFgVSgZ4YemlWdH5gz.jpg': require('../../assets/images/vehicles/toyota-hiace-2019.png'),
  'qOZY9KSRWygyWiP5zTKSGBX5RYauxnpz82lG0qqj.jpg': require('../../assets/images/vehicles/toyota-hiace-2024.png'),
  'T0EQm3GUYyrw6jLJvbxjJ5UiG62lcgmcPHLw9SyC.jpg': require('../../assets/images/vehicles/toyota-innova-2025.png'),
  'wOwmXCdUwf5nV3KtscuBS82hJAquwAk2qtcwkMtY.jpg': require('../../assets/images/vehicles/toyota-innova-2026.png'),
  'vtbylE5jp7aRRLaL7hkHwsAKi3ZxCIgmSe1UBcRf.jpg': require('../../assets/images/vehicles/toyota-vios-2018.png'),
};

export function getVehicleImageSource(uri?: string | null): ImageSourcePropType | undefined {
  if (!uri) return undefined;

  const path = uri.split(/[?#]/, 1)[0];
  const filename = path.match(/(?:^|\/)vehicles\/([^/]+)$/)?.[1];
  return (filename && transparentVehicleImages[filename]) || { uri };
}
