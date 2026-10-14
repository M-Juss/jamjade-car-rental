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
    <View className="items-center rounded-[32px] border border-dashed border-[#C8D4E8] bg-surface p-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <CalendarX size={30} color={themeColors.primary} strokeWidth={2.25} />
      </View>
      <Text className="font-sans mt-4 text-center text-[20px] font-semibold text-foreground">{title}</Text>
      <Text className="font-sans mt-2 text-center text-[14px] font-normal leading-5 text-secondary-foreground">
        {subtitle}
      </Text>
      {onBrowsePress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBrowsePress}
          className="mt-6 min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-success px-6">
          <Car size={17} color={themeColors.surface} strokeWidth={2.45} />
          <Text className="font-sans text-[15px] font-semibold text-surface">{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
