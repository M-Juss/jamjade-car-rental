import { Text, View } from 'react-native';

export function BookingLoadingState() {
  return (
    <View className="gap-section">
      <Text className="font-sans text-[13px] font-medium text-secondary-foreground">
        Loading your bookings...
      </Text>
      {[1, 2, 3].map((item) => (
        <View key={item} className="overflow-hidden rounded-card border border-border bg-surface p-4">
          <View className="h-[168px] rounded-card bg-muted" />
          <View className="mt-4 h-6 w-3/4 rounded-full bg-muted" />
          <View className="mt-3 h-4 w-1/2 rounded-full bg-[#EEF3FB]" />
          <View className="mt-section gap-2">
            <View className="h-4 w-full rounded-full bg-[#EEF3FB]" />
            <View className="h-4 w-5/6 rounded-full bg-[#EEF3FB]" />
            <View className="h-4 w-4/6 rounded-full bg-[#EEF3FB]" />
          </View>
          <View className="mt-section flex-row gap-2">
            <View className="h-11 flex-1 rounded-full bg-muted" />
            <View className="h-11 flex-1 rounded-full bg-[#EEF3FB]" />
          </View>
        </View>
      ))}
    </View>
  );
}
