import { ArrowLeft, Fuel, Gauge, Heart, Palette, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';
import { formatPeso } from '@/lib/browse/pricing';
import type { Vehicle } from '@/types/browse';

import { FeatureBadge, VehicleImage } from './BrowseComponents';

type VehicleDetailsContentProps = {
  vehicle: Vehicle;
  isBookmarked: boolean;
  bookNowDisabled?: boolean;
  bookNowInfo?: string;
  onBackPress: () => void;
  onBookmarkPress: () => void;
  onBookNow: () => void;
};

export function VehicleDetailsContent({
  vehicle,
  isBookmarked,
  bookNowDisabled = false,
  bookNowInfo,
  onBackPress,
  onBookmarkPress,
  onBookNow,
}: VehicleDetailsContentProps) {
  const insets = useSafeAreaInsets();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const vehicleTitle = [vehicle.brand, vehicle.name, vehicle.model].filter(Boolean).join(' ');
  const images = Array.from(new Set([vehicle.cardImage, ...vehicle.images].filter(
    (image): image is string => Boolean(image),
  )));
  const activeImage = images[activeImageIndex] ?? images[0];
  const description = vehicle.description.trim() || 'No vehicle description has been added yet.';
  const isDescriptionLong = description.length > 180;
  const specs = [
    { icon: Gauge, label: 'Transmission', value: vehicle.transmission },
    { icon: Users, label: 'Seats', value: String(vehicle.seats) },
    { icon: Fuel, label: 'Fuel type', value: vehicle.fuelType },
    { icon: Palette, label: 'Color', value: vehicle.color },
  ];

  return (
    <View
      className="flex-1 bg-muted"
      style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View
          className="mx-auto w-full max-w-[680px] px-4 pb-4"
          style={{ paddingTop: insets.top + 8 }}>
          <View className="flex-row items-center justify-between gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Browse"
              onPress={onBackPress}
              className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface active:opacity-70">
              <ArrowLeft size={22} color={themeColors.foreground} strokeWidth={2} />
            </Pressable>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              className="font-sans min-w-0 flex-1 text-center text-[20px] font-semibold text-foreground">
              Car Details
            </Text>
            <View className="shrink-0 flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isBookmarked ? `Remove ${vehicleTitle} bookmark` : `Bookmark ${vehicleTitle}`}
                accessibilityState={{ selected: isBookmarked }}
                onPress={onBookmarkPress}
                className="h-11 w-11 items-center justify-center rounded-full bg-surface active:opacity-70">
                <Heart
                  size={22}
                  color={isBookmarked ? themeColors.primary : themeColors.foreground}
                  fill={isBookmarked ? themeColors.primary : 'none'}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
          </View>

          <Text accessibilityRole="header" className="font-sans mt-4 text-[26px] font-semibold leading-[31px] text-foreground">
            {vehicleTitle}
          </Text>

          <View className="mt-4 flex-row items-stretch gap-3">
            <View className="w-28 shrink-0 gap-3">
              {specs.map(({ icon: Icon, label, value }) => (
                <View key={label}>
                  <View className="flex-row items-center gap-1">
                    <Icon accessible={false} size={14} color={themeColors.primary} strokeWidth={1.8} />
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      className="font-sans min-w-0 flex-1 text-[13px] leading-[18px] text-muted-foreground">
                      {label}
                    </Text>
                  </View>
                  <Text className="font-sans mt-0.5 text-[16px] font-medium leading-[20px] text-foreground">{value}</Text>
                </View>
              ))}
            </View>
            <View className="relative min-w-0 flex-1 overflow-hidden rounded-[20px]">
              <VehicleImage
                accessibilityLabel={`${vehicleTitle}, photo ${activeImageIndex + 1}`}
                uri={activeImage}
                resizeMode="contain"
                className="absolute inset-0 h-full w-full"
              />
            </View>
          </View>

          {images.length > 0 && (
            <ScrollView
              horizontal
              className="mt-4"
              contentContainerClassName="gap-2.5"
              showsHorizontalScrollIndicator={false}>
              {images.map((image, index) => (
                <Pressable
                  key={image}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${vehicleTitle} photo ${index + 1} of ${images.length}`}
                  accessibilityState={{ selected: activeImage === image }}
                  onPress={() => setActiveImageIndex(index)}
                  className={`h-[76px] w-[76px] overflow-hidden rounded-[18px] border-2 bg-surface p-0.5 ${
                    activeImage === image ? 'border-primary' : 'border-surface'
                  }`}>
                  <VehicleImage uri={image} className="h-full w-full rounded-[14px]" />
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View className="mt-4 rounded-[22px] border border-border bg-surface p-4">
            <Text accessibilityRole="header" className="font-sans text-[17px] font-semibold text-foreground">
              Description
            </Text>
            <Text
              className="font-sans mt-2 text-[15px] leading-[22px] text-muted-foreground"
              numberOfLines={isDescriptionExpanded || !isDescriptionLong ? undefined : 3}>
              {description}
            </Text>
            {isDescriptionLong && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isDescriptionExpanded ? 'Show less description' : 'Read full description'}
                accessibilityState={{ expanded: isDescriptionExpanded }}
                onPress={() => setIsDescriptionExpanded((expanded) => !expanded)}
                className="min-h-11 justify-center self-start pr-4 active:opacity-70">
                <Text className="font-sans text-[14px] font-medium text-primary">
                  {isDescriptionExpanded ? 'See Less' : 'See More'}
                </Text>
              </Pressable>
            )}
          </View>

          <View className="mt-3 rounded-[22px] border border-border bg-surface p-4">
            <Text accessibilityRole="header" className="font-sans text-[17px] font-semibold text-foreground">
              Features
            </Text>
            {vehicle.features.length > 0 ? (
              <View className="-mx-1 mt-2 flex-row flex-wrap">
                {vehicle.features.map((feature) => (
                  <View key={feature} className="w-1/3 p-1">
                    <FeatureBadge label={feature} />
                  </View>
                ))}
              </View>
            ) : (
              <Text className="font-sans mt-2 text-[15px] leading-[22px] text-muted-foreground">
                No additional features have been listed.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View
        className="mx-auto w-full max-w-[680px] px-4 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        {bookNowDisabled && bookNowInfo && (
          <Text accessibilityRole="alert" className="font-sans mb-3 px-1 text-[12px] leading-[18px] text-foreground">
            {bookNowInfo}
          </Text>
        )}
        <View className="min-h-16 flex-row flex-wrap items-center justify-between gap-3 rounded-[32px] bg-foreground p-2 pl-5">
          <Text className="font-sans shrink text-[24px] font-semibold text-surface">
            {formatPeso(vehicle.pricePerDay)}
            <Text className="text-[13px] font-medium text-surface">/day</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bookNowDisabled ? 'Book Now unavailable until your balance is settled' : `Book ${vehicleTitle}`}
            accessibilityState={{ disabled: bookNowDisabled }}
            disabled={bookNowDisabled}
            onPress={onBookNow}
            className={`min-h-12 items-center justify-center rounded-full px-6 py-3 ${
              bookNowDisabled ? 'bg-surface' : 'bg-primary active:bg-primary-hover'
            }`}>
            <Text className={`font-sans text-[15px] font-medium ${bookNowDisabled ? 'text-muted-foreground' : 'text-surface'}`}>
              Book Now
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
