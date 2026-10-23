import { ArrowUpRight, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import { JAMJADE_GARAGE, SHOP_MAPS_URL } from '@/lib/browse/rental-config';

export function GarageLocationLink() {
  const [hasError, setHasError] = useState(false);

  const openMaps = async () => {
    try {
      await Linking.openURL(SHOP_MAPS_URL);
      setHasError(false);
    } catch {
      setHasError(true);
    }
  };

  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="View Jamjade Garage on Google Maps"
        onPress={() => void openMaps()}
        className="min-h-control flex-row items-center gap-3 rounded-card border border-border bg-surface p-4 active:opacity-70">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
          <MapPin accessible={false} size={21} color={themeColors.primary} strokeWidth={2.35} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-body font-semibold text-foreground">{JAMJADE_GARAGE}</Text>
          <Text className="font-sans mt-1 text-caption font-medium text-primary underline">
            View on Google Maps
          </Text>
        </View>
        <ArrowUpRight accessible={false} size={20} color={themeColors.primary} strokeWidth={2.35} />
      </Pressable>
      {hasError ? (
        <Text accessibilityRole="alert" className="font-sans mt-2 text-caption text-destructive">
          Google Maps could not open. Tap the location to try again.
        </Text>
      ) : null}
    </View>
  );
}
