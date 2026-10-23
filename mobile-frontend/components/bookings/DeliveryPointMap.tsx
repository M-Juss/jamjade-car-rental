import { Platform, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type Point = { latitude: number; longitude: number };

export function DeliveryPointMap({ point, onReady, unavailableMessage = 'The delivery map is unavailable. Use View Delivery Point to open Google Maps.' }: { point: Point; onReady?: () => void; unavailableMessage?: string }) {
  const configured = Platform.OS === 'ios'
    ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY)
    : Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);

  if (!configured) return (
    <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">
      {unavailableMessage}
    </Text>
  );

  return (
    <View style={{ height: 240 }} className="overflow-hidden rounded-card">
      <MapView
        key={`${point.latitude},${point.longitude}`}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{ ...point, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        onMapReady={onReady}
        showsUserLocation={false}
        toolbarEnabled={false}>
        <Marker coordinate={point} draggable={false} title="Delivery and end trip" />
      </MapView>
    </View>
  );
}
