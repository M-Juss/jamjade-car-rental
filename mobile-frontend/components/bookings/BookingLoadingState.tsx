import { Text, View } from 'react-native';

export function BookingLoadingState() {
  return (
    <View className="gap-5">
      <Text className="text-[13px] font-bold text-[#6C7A96]">Loading your bookings...</Text>
      {[1, 2, 3].map((item) => (
        <View key={item} className="overflow-hidden rounded-[30px] border border-[#E6EEFF] bg-white p-4">
          <View className="h-[168px] rounded-[22px] bg-[#E9EFFA]" />
          <View className="mt-4 h-6 w-3/4 rounded-full bg-[#E9EFFA]" />
          <View className="mt-3 h-4 w-1/2 rounded-full bg-[#EEF3FB]" />
          <View className="mt-5 gap-2">
            <View className="h-4 w-full rounded-full bg-[#EEF3FB]" />
            <View className="h-4 w-5/6 rounded-full bg-[#EEF3FB]" />
            <View className="h-4 w-4/6 rounded-full bg-[#EEF3FB]" />
          </View>
          <View className="mt-5 flex-row gap-2">
            <View className="h-11 flex-1 rounded-full bg-[#E9EFFA]" />
            <View className="h-11 flex-1 rounded-full bg-[#EEF3FB]" />
          </View>
        </View>
      ))}
    </View>
  );
}
