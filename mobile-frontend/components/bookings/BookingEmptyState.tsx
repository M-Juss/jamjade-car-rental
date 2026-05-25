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
    <View className="items-center rounded-[32px] border border-dashed border-[#C8D4E8] bg-white p-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#EEF4FF]">
        <CalendarX size={30} color="#346EF6" strokeWidth={2.25} />
      </View>
      <Text className="mt-4 text-center text-[20px] font-black text-[#17315F]">{title}</Text>
      <Text className="mt-2 text-center text-[14px] font-semibold leading-5 text-[#6C7A96]">{subtitle}</Text>
      {onBrowsePress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBrowsePress}
          className="mt-6 min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-[#065F46] px-6">
          <Car size={17} color="#FFFFFF" strokeWidth={2.45} />
          <Text className="text-[15px] font-black text-white">{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
