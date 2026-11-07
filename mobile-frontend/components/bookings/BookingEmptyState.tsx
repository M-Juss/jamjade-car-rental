import { themeColors } from '@/constants/theme';
import { CalendarX, Car } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

export function BookingEmptyState({
  buttonLabel = 'Browse Vehicles',
  onBrowsePress,
  subtitle,
  title,
}: {
  title: string;
  subtitle: string;
  buttonLabel?: string;
  onBrowsePress?: () => void;
}) {
  return (
    <View className="items-center rounded-card border border-border bg-surface px-card py-6">
      <CalendarX size={24} color={themeColors.primary} strokeWidth={2} />
      <Text className="font-sans mt-4 text-center text-[20px] font-semibold text-foreground">{title}</Text>
      <Text className="font-sans mt-2 text-center text-[14px] font-normal leading-5 text-secondary-foreground">
        {subtitle}
      </Text>
      {onBrowsePress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBrowsePress}
          className="mt-section min-h-control flex-row items-center justify-center gap-2 rounded-field bg-primary px-4 py-3">
          <Car size={17} color={themeColors.surface} strokeWidth={2.45} />
          <Text className="font-sans shrink text-center text-button font-medium text-surface">{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
