import { Image } from 'expo-image';
import { CalendarDays, Clock3 } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { VehicleImage } from '@/components/browse/BrowseComponents';
import { themeColors } from '@/constants/theme';
import { getVehicleImageSource } from '@/lib/browse/vehicle-image-source';
import { formatRentalDateCompact } from '@/lib/telematics/rental-card';
import type { MobileTelematicsHandover } from '@/services/api';

export function TelematicsVehicleSummary({ handover }: { handover: MobileTelematicsHandover }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = handover.vehicle.secondaryImage || handover.vehicle.image;
  const source = getVehicleImageSource(image);
  return <View className="shrink-0 flex-row items-stretch gap-2 border-b border-border pb-3">
    <View className="min-w-0 flex-1 gap-1">
      <Text accessibilityRole="header" className="font-sans text-[19px] font-semibold leading-6 text-primary">{handover.bookingCode}</Text>
      <View className="mt-1 gap-2">
        <View className="min-w-0 gap-0.5">
          <View className="flex-row items-center gap-1"><CalendarDays size={11} color={themeColors.primary} /><Text className="font-sans text-[10px] leading-4 text-secondary-foreground">Rental date</Text></View>
          <Text className="font-sans text-[12px] font-semibold leading-[18px] text-foreground">{formatRentalDateCompact(handover.rentalStartAt ?? null)}</Text>
        </View>
        <View className="min-w-0 gap-0.5">
          <View className="flex-row items-center gap-1"><Clock3 size={11} color={themeColors.primary} /><Text className="font-sans text-[10px] leading-4 text-secondary-foreground">Return</Text></View>
          <Text className="font-sans text-[12px] font-semibold leading-[18px] text-foreground">{formatRentalDateCompact(handover.rentalEndAt)}</Text>
        </View>
      </View>
    </View>
    <View className="w-[38%] self-stretch overflow-hidden rounded-field">
      {image && image !== failedImage ? <Image source={source} accessibilityLabel={handover.vehicle.name} contentFit="contain" contentPosition="center" onError={() => setFailedImage(image)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        : <VehicleImage uri={null} className="absolute inset-0" />}
    </View>
  </View>;
}
