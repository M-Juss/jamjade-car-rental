import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { themeColors } from '@/constants/theme';
import type { TelematicsMapProps } from './TelematicsMap';

export function TelematicsMap({ point, recenter }: TelematicsMapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const configured = Platform.OS === 'ios'
    ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY)
    : Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);
  const latest = useRef(point);
  latest.current = point;
  const located = useRef(false);

  useEffect(() => {
    if (ready && point && !located.current) {
      located.current = true;
      map.current?.animateToRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 300);
    }
    if (!point) located.current = false;
  }, [point, ready]);
  useEffect(() => {
    const fix = latest.current;
    if (ready && fix) map.current?.animateToRegion({ latitude: fix.latitude, longitude: fix.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 300);
  }, [recenter, ready]);

  if (!configured) return <View className="flex-1 items-center justify-center bg-muted px-screen">
    <Text accessibilityRole="alert" className="font-sans text-center text-body text-secondary-foreground">The map is unavailable.</Text>
  </View>;

  return <MapView ref={map} provider={PROVIDER_GOOGLE} style={{ flex: 1 }}
    initialRegion={{ latitude: 14.45, longitude: 120.96, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
    onMapReady={() => setReady(true)} toolbarEnabled={false} showsUserLocation={false} showsMyLocationButton={false}>
    {point ? <Marker coordinate={{ latitude: point.latitude, longitude: point.longitude }} pinColor={themeColors.primary} title="Latest GPS location" /> : null}
  </MapView>;
}
