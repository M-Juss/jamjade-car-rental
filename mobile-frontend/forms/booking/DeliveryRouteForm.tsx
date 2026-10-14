import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Platform, Pressable, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { InputWithLabel } from '@/components/common/InputWithLabel';
import { LocationSearchWithLabel } from '@/components/common/LocationSearchWithLabel';
import { themeColors } from '@/constants/theme';
import { ApiError } from '@/services/http';
import {
  deliveryRoutesSchema,
  type DeliveryRoutesValues,
} from '@/validation/booking/delivery';
import {
  getDeliveryQuote,
  getDeliveryQuotes,
  quoteMatches,
  requestDeliveryRoutes,
  selectDeliveryRoute,
  type DeliveryQuote,
  type DeliveryRoute,
} from '@/services/api/delivery.service';
import { formatPeso } from '@/lib/browse/pricing';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
function decodePolyline(encoded: string) {
  let index = 0,
    lat = 0,
    lng = 0;
  const points: { latitude: number; longitude: number }[] = [];
  const read = () => {
    let result = 0,
      shift = 0,
      byte: number;
    do {
      if (index >= encoded.length) throw new Error('Invalid route');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  try {
    while (index < encoded.length) {
      lat += read();
      lng += read();
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
  } catch {
    return [];
  }
  return points;
}
export function DeliveryRouteForm({
  vehicleId,
  initialQuote,
  start,
  end,
  coverage,
  address,
  onAddress,
  onQuote,
}: {
  vehicleId: string;
  initialQuote?: DeliveryQuote;
  start: string;
  end: string;
  coverage: 'metro_manila' | 'outside_manila';
  address: string;
  onAddress: (address: string) => void;
  onQuote: (quote: DeliveryQuote | null) => void;
}) {
  const toast = useFormToast();
  const map = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapConfigured =
    Platform.OS === 'ios'
      ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY)
      : Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);
  const form = useForm<DeliveryRoutesValues>({
    resolver: zodResolver(deliveryRoutesSchema),
    defaultValues: {
      vehicleId,
      rentalStartAt: start,
      rentalEndAt: end,
      ownerDriverCoverage: coverage,
      address,
      placeId: initialQuote?.destinationPlaceId ?? null,
      latitude: initialQuote?.destinationPoint?.latitude,
      longitude: initialQuote?.destinationPoint?.longitude,
      pointConfirmed: Boolean(initialQuote),
    },
  });
  const [point, setPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialQuote?.destinationPoint ?? null);
  const [searchText, setSearchText] = useState(
    initialQuote?.destinationAddress ?? '',
  );
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [selected, setSelected] = useState<DeliveryQuote | null>(
    initialQuote ?? null,
  );
  const [preview, setPreview] = useState<DeliveryRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<DeliveryQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const invalidate = () => {
    setRoutes([]);
    setSelected(null);
    setPreview(null);
    onQuote(null);
  };
  useEffect(() => {
    let active = true;
    getDeliveryQuotes()
      .then((r) => {
        if (active)
          setSaved(
            r.data.filter(
              (q) =>
                ['ready', 'awaiting_review'].includes(q.status) &&
                quoteMatches(
                  q,
                  vehicleId,
                  start,
                  end,
                  coverage,
                  q.destinationAddress,
                ),
            ),
          );
      })
      .catch(() => {
        if (active)
          setError(
            'Saved delivery requests could not be loaded. Refresh to try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [vehicleId, start, end, coverage]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (selected?.status !== 'awaiting_review') return;
    let active = true;
    const timer = setInterval(() => {
      getDeliveryQuote(selected.id)
        .then((q) => {
          if (active) {
            setSelected(q);
            onQuote(q);
            setError(null);
          }
        })
        .catch(() => {
          if (active)
            setError(
              'Unable to check staff approval. Check your connection and refresh.',
            );
        });
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected?.id, selected?.status, onQuote]);
  const updateQuote = (q: DeliveryQuote) => {
    setSelected(q);
    onQuote(q);
    onAddress(q.destinationAddress);
    setError(null);
  };
  const refresh = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      updateQuote(await getDeliveryQuote(selected.id));
    } catch {
      setError('Delivery quote could not be refreshed. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const request = async (values: DeliveryRoutesValues) => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestDeliveryRoutes(values);
      setRoutes(result);
      setPreview(result[0] ?? null);
      setSelected(null);
      onQuote(null);
      toast.showToast('Delivery routes loaded. Choose a route.', 'success');
    } catch (e) {
      if (e instanceof ApiError)
        for (const [key, messages] of Object.entries(e.errors ?? {})) {
          const mapping: Record<string, keyof DeliveryRoutesValues> = {
            vehicle_id: 'vehicleId',
            rental_start_at: 'rentalStartAt',
            rental_end_at: 'rentalEndAt',
            owner_driver_coverage: 'ownerDriverCoverage',
            destination_address: 'address',
            destination_place_id: 'placeId',
            latitude: 'latitude',
            longitude: 'longitude',
            point_confirmed: 'pointConfirmed',
          };
          form.setError(mapping[key] ?? 'root', { message: messages[0] });
        }
      setError(
        'Delivery routes could not be loaded. Check the address, schedule, and map confirmation.',
      );
      toast.showToast('Delivery routes could not be loaded.');
    } finally {
      setBusy(false);
    }
  };
  const choose = async (route: DeliveryRoute) => {
    setBusy(true);
    try {
      updateQuote(await selectDeliveryRoute(route.quote.id));
      setPreview(route);
      setRoutes([]);
      toast.showToast(
        route.quote.tollStatus === 'toll_free'
          ? 'Delivery quote is ready.'
          : 'Delivery sent for staff toll review.',
        'success',
      );
    } catch {
      setError('This route could not be selected. Get new routes.');
      toast.showToast('Route selection failed. Get new routes.');
    } finally {
      setBusy(false);
    }
  };
  const routePoints = useMemo(
    () =>
      preview?.encodedPolyline ? decodePolyline(preview.encodedPolyline) : [],
    [preview?.encodedPolyline],
  );
  useEffect(() => {
    if (routePoints.length)
      map.current?.fitToCoordinates(routePoints, {
        edgePadding: { top: 32, bottom: 32, left: 32, right: 32 },
        animated: true,
      });
  }, [routePoints]);
  const expired = selected?.expiresAt && Date.parse(selected.expiresAt) <= now;
  return (
    <View className="gap-4 rounded-card border border-border bg-surface p-4">
      <LocationSearchWithLabel
        label="Delivery and end trip address"
        value={searchText}
        disabled={busy}
        error={form.formState.errors.address?.message}
        helperText="Choose a resolved address, then confirm its map point."
        onChangeText={(value) => {
          setSearchText(value);
          setPoint(null);
          setMapReady(false);
          form.setValue('pointConfirmed', false);
          invalidate();
        }}
        onSelectPlace={(place) => {
          invalidate();
          map.current?.animateToRegion({
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          });
          setPoint({ latitude: place.latitude, longitude: place.longitude });
          form.setValue('latitude', place.latitude);
          form.setValue('longitude', place.longitude);
          form.setValue('placeId', place.placeId);
          form.setValue('address', place.address);
          form.setValue('pointConfirmed', false);
          onAddress(place.address);
          setSearchText(place.address);
        }}
      />
      {point && (
        <>
          {!mapConfigured && (
            <Text
              accessibilityRole="alert"
              className="font-sans text-caption text-destructive"
            >
              The delivery map is currently unavailable. Choose garage pickup or
              try again later.
            </Text>
          )}
          <View
            style={{ height: 240 }}
            className="overflow-hidden rounded-card"
          >
            {mapConfigured && (
              <MapView
                onMapReady={() => setMapReady(true)}
                ref={map}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={{
                  ...point,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }}
                onPress={(e) => {
                  if (busy) return;
                  const p = e.nativeEvent.coordinate;
                  setPoint(p);
                  form.setValue('latitude', p.latitude);
                  form.setValue('longitude', p.longitude);
                  form.setValue('pointConfirmed', false);
                  form.setValue('placeId', null);
                  invalidate();
                }}
              >
                <Marker
                  coordinate={point}
                  draggable={!busy}
                  onDragEnd={(e) => {
                    const p = e.nativeEvent.coordinate;
                    setPoint(p);
                    form.setValue('latitude', p.latitude);
                    form.setValue('longitude', p.longitude);
                    form.setValue('pointConfirmed', false);
                    form.setValue('placeId', null);
                    invalidate();
                  }}
                />
                {preview?.encodedPolyline && (
                  <Polyline
                    coordinates={routePoints}
                    strokeColor={themeColors.primary}
                    strokeWidth={4}
                  />
                )}
              </MapView>
            )}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: form.watch('pointConfirmed'),
              disabled: busy || !mapReady,
            }}
            disabled={busy || !mapReady}
            className="min-h-control justify-center rounded-field border border-border px-4"
            onPress={() =>
              form.setValue('pointConfirmed', !form.getValues('pointConfirmed'))
            }
          >
            <Text className="font-sans text-body text-foreground">
              {form.watch('pointConfirmed') ? '✓ ' : ''}I confirm this delivery
              point and end trip address
            </Text>
          </Pressable>
        </>
      )}
      {point && (
        <InputWithLabel
          label="Complete delivery address"
          value={address}
          required
          disabled={busy}
          helperText="Confirm or correct the street, barangay, city, and any delivery instructions."
          onChangeText={(value) => {
            onAddress(value);
            form.setValue('address', value);
            form.setValue('pointConfirmed', false);
            invalidate();
          }}
        />
      )}
      {Object.entries(form.formState.errors).map(([key, value]) => (
        <Text
          key={key}
          accessibilityRole="alert"
          className="font-sans text-caption text-destructive"
        >
          {value?.message}
        </Text>
      ))}
      <Pressable
        disabled={busy || !point || !mapReady}
        accessibilityRole="button"
        className="min-h-control items-center justify-center rounded-field bg-primary px-4 disabled:opacity-50"
        onPress={form.handleSubmit(request, () =>
          toast.showToast('Check the schedule and confirm your map point.'),
        )}
      >
        <Text className="font-sans text-body font-semibold text-surface">
          {busy ? 'Please wait...' : 'Get Delivery Routes'}
        </Text>
      </Pressable>
      {routes.map((route) => (
        <View
          key={route.quote.id}
          className="gap-2 rounded-card border border-border p-3"
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setPreview(route)}
          >
            <Text className="font-sans text-body font-semibold text-foreground">
              {route.quote.routeLabel} ·{' '}
              {(route.distanceMeters / 1000).toFixed(2)} km ·{' '}
              {Math.ceil(route.durationSeconds / 60)} min
            </Text>
            <Text className="font-sans text-caption text-secondary-foreground">
              Delivery {formatPeso(route.quote.deliveryFee)} ·{' '}
              {route.quote.tollStatus === 'toll_free'
                ? 'Toll-free'
                : route.quote.tollStatus === 'toll'
                  ? 'Toll approval required'
                  : 'Toll status needs staff verification'}
            </Text>
            <Text className="font-sans text-caption text-primary">
              Show route on map
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            className="min-h-control items-center justify-center rounded-field bg-primary"
            onPress={() => void choose(route)}
          >
            <Text className="font-sans text-body font-semibold text-surface">
              Choose {route.quote.routeLabel}
            </Text>
          </Pressable>
        </View>
      ))}
      {selected && (
        <View className="gap-2 rounded-card bg-muted p-3">
          <Text className="font-sans text-body font-semibold text-foreground">
            {expired
              ? 'Quote unavailable. Get new routes.'
              : selected.status === 'awaiting_review'
                ? 'Awaiting staff toll approval'
                : selected.status === 'ready'
                  ? 'Complete delivery quote'
                  : selected.status === 'rejected'
                    ? 'Delivery request rejected'
                    : 'Quote unavailable. Get new routes.'}
          </Text>
          <Text className="font-sans text-caption text-secondary-foreground">
            {selected.status === 'ready' && !expired
              ? `Delivery ${formatPeso(selected.deliveryFee)} + toll ${formatPeso(selected.deliveryTollFee ?? 0)}. Total ${formatPeso(selected.totalAmount ?? 0)}. Valid for ${Math.max(0, Math.ceil((Date.parse(selected.expiresAt!) - now) / 60000))} more minute(s).`
              : 'This request does not reserve the vehicle or take payment. Return here to refresh its status.'}
          </Text>
          {selected.reviewNote && (
            <Text className="font-sans text-caption text-foreground">
              {selected.reviewNote}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            className="min-h-control justify-center"
            onPress={() => void refresh()}
          >
            <Text className="font-sans text-body font-semibold text-primary">
              Refresh Quote
            </Text>
          </Pressable>
        </View>
      )}
      {!selected &&
        saved.map((q) => (
          <Pressable
            accessibilityRole="button"
            key={q.id}
            className="min-h-control rounded-field border border-border p-3"
            onPress={() => {
              setPoint(q.destinationPoint);
              if (q.destinationPoint) {
                form.setValue('latitude', q.destinationPoint.latitude);
                form.setValue('longitude', q.destinationPoint.longitude);
              }
              form.setValue('address', q.destinationAddress);
              updateQuote(q);
            }}
          >
            <Text className="font-sans text-caption text-primary">
              Resume {q.status === 'ready' ? 'approved' : 'pending'} request:{' '}
              {q.destinationAddress}
            </Text>
          </Pressable>
        ))}
      {error && (
        <Text
          accessibilityRole="alert"
          className="font-sans text-caption text-destructive"
        >
          {error}
        </Text>
      )}
      <FormToast
        message={toast.message}
        onDismiss={toast.clearToast}
        title={toast.title}
        variant={toast.variant}
      />
    </View>
  );
}
