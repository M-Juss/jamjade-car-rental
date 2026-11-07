import { Text, View } from 'react-native';

export function MetadataList({ items }: {
  items: readonly { label: string; value: string | number }[];
}) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-2">
      {items.map(({ label, value }) => (
        <View key={label} className="min-w-[96px] basis-[45%] grow gap-0.5">
          <Text className="font-sans text-caption text-secondary-foreground">{label}</Text>
          <Text className="font-sans text-caption font-medium text-foreground">{value}</Text>
        </View>
      ))}
    </View>
  );
}
