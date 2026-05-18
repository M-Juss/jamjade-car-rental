import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-red-400 px-6">
      <Text className="text-3xl font-bold text-white ">Home</Text>
      <Text className="mt-2 text-base text-white/90">NativeWind is now applied to this screen.</Text>
    </View>
  );
}
