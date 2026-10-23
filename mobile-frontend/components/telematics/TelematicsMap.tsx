import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import type { LatestLocationFix } from '@/validation/telematics/location-monitoring';

export type TelematicsMapProps = { point: LatestLocationFix | null; recenter: number };

export function TelematicsMap(_props: TelematicsMapProps) {
  return <View className="flex-1 items-center justify-center gap-2 bg-muted">
    <MapPin size={24} color={themeColors.primary} />
    <Text className="font-sans text-caption text-secondary-foreground">Open the Android or iOS app to view the map.</Text>
  </View>;
}
