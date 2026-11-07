import { MetadataList } from '@/components/common/MetadataList';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, Text, View } from 'react-native';
import { DeliveryPointMap } from '@/components/bookings/DeliveryPointMap';
import { InputWithLabel } from '@/components/common/InputWithLabel';
import { LocationSearchWithLabel } from '@/components/common/LocationSearchWithLabel';
import { ApiError } from '@/services/http';
import { deliveryRoutesSchema, type DeliveryRoutesValues } from '@/validation/booking/delivery';
import {
  confirmDeliveryLocation,
  type DeliveryQuote, type DeliveryEstimate,
} from '@/services/api/delivery.service';
import { formatPeso } from '@/lib/browse/pricing';
import { isReadyDeliveryQuote } from '@/lib/browse/delivery-quotes';
import type { FormToastVariant } from '@/forms/shared/FormToast';

export function DeliveryRouteForm({
  vehicleId, start, end, coverage, address, note, noteError,
  onAddress, onNote, onQuote, onToast, onValidateSchedule,
}: {
  vehicleId: string;
  start: string;
  end: string;
  coverage: 'metro_manila' | 'outside_manila';
  address: string;
  note: string;
  noteError?: string;
  onAddress: (address: string) => void;
  onNote: (note: string) => void;
  onQuote: (quote: DeliveryQuote | null) => void;
  onToast: (message: string, variant?: FormToastVariant) => void;
  onValidateSchedule: () => Promise<boolean>;
}) {
  const submitting = useRef(false);
  const generation = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchText, setSearchText] = useState(address);
  const [selected, setSelected] = useState<DeliveryQuote | null>(null);
  const [estimate, setEstimate] = useState<(DeliveryEstimate & { quoteId: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const schedule = useRef({ vehicleId, start, end, coverage });
  const form = useForm<DeliveryRoutesValues>({
    resolver: zodResolver(deliveryRoutesSchema),
    defaultValues: {
      vehicleId, rentalStartAt: start, rentalEndAt: end, ownerDriverCoverage: coverage, address,
      placeId: null,
      pointConfirmed: false,
    },
  });
  const { setValue, clearErrors } = form;

  useEffect(() => {
    setValue('vehicleId', vehicleId);
    setValue('rentalStartAt', start);
    setValue('rentalEndAt', end);
    setValue('ownerDriverCoverage', coverage);
    const previous = schedule.current;
    const changed = previous.vehicleId !== vehicleId || previous.start !== start || previous.end !== end || previous.coverage !== coverage;
    if (changed) {
      generation.current += 1;
      setSelected(null);
      setEstimate(null);
      setError(null);
      clearErrors();
      onQuote(null);
    }
    schedule.current = { vehicleId, start, end, coverage };
  }, [vehicleId, start, end, coverage, setValue, clearErrors, onQuote]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => () => { generation.current += 1; }, []);

  const invalidate = () => {
    generation.current += 1;
    setSelected(null);
    setEstimate(null);
    setError(null);
    onQuote(null);
  };
  const request = async (values: DeliveryRoutesValues) => {
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmDeliveryLocation(values);
      if (current !== generation.current) return;
      setEstimate({ ...result, quoteId: result.quote.id });
      setSelected(result.quote);
      onQuote(result.quote);
      onToast('Delivery location confirmed.', 'success');
    } catch (e) {
      if (current !== generation.current) return;
      let hasFieldError = false;
      let unmappedMessage: string | undefined;
      if (e instanceof ApiError && e.status === 422) {
        const mapping: Record<string, keyof DeliveryRoutesValues> = {
          vehicle_id: 'vehicleId', rental_start_at: 'rentalStartAt', rental_end_at: 'rentalEndAt',
          owner_driver_coverage: 'ownerDriverCoverage', destination_address: 'address',
          destination_place_id: 'placeId', latitude: 'latitude', longitude: 'longitude', point_confirmed: 'pointConfirmed',
        };
        for (const [key, messages] of Object.entries(e.errors ?? {})) {
          if (mapping[key]) {
            form.setError(mapping[key], { message: messages[0] });
            hasFieldError = true;
          } else {
            unmappedMessage ??= messages[0];
          }
        }
      }
      const validationMessage = e instanceof ApiError && e.status === 422
        ? Object.values(e.errors ?? {}).flat()[0]
        : undefined;
      const message = validationMessage ?? 'Location could not be confirmed. Check your connection and try again.';
      setError(unmappedMessage ?? (hasFieldError ? null : message));
      onToast(message);
    } finally {
      setBusy(false);
    }
  };
  const confirmLocation = async () => {
    if (busy || submitting.current || !point || !mapReady) return;
    submitting.current = true;
    try {
      if (!(await onValidateSchedule())) return;
      if (noteError) { onToast('Check the delivery note.'); return; }
      form.clearErrors();
      setValue('rentalStartAt', start);
      setValue('rentalEndAt', end);
      setValue('ownerDriverCoverage', coverage);
      setValue('pointConfirmed', true);
      await form.handleSubmit(request, () => onToast('Check the highlighted delivery details.'))();
    } finally { submitting.current = false; }
  };
  const confirmed = isReadyDeliveryQuote(selected, now);
  const locked = Boolean(selected && !selected.requiresRequote);

  return (
    <View className="gap-4 rounded-card border border-border bg-surface p-4">
      {locked ? (
        <Text className="font-sans text-body font-semibold text-foreground">{selected?.destinationAddress}</Text>
      ) : (
        <LocationSearchWithLabel
          label="Delivery and end trip address"
          value={searchText}
          disabled={busy}
          error={form.formState.errors.address?.message}
          onChangeText={(value) => {
            invalidate();
            setSearchText(value);
            setPoint(null);
            setMapReady(false);
            setValue('address', '');
            setValue('pointConfirmed', false);
            onAddress('');
          }}
          onSelectPlace={(place) => {
            invalidate();
            setPoint({ latitude: place.latitude, longitude: place.longitude });
            setMapReady(false);
            setValue('latitude', place.latitude);
            setValue('longitude', place.longitude);
            setValue('placeId', place.placeId);
            setValue('address', place.address);
            setValue('pointConfirmed', false);
            onAddress(place.address);
            setSearchText(place.address);
          }}
        />
      )}
      {point && <DeliveryPointMap point={point} onReady={() => setMapReady(true)} unavailableMessage="The delivery map is unavailable. Choose garage pickup or try again later." />}
      {point && (locked ? (
        note.trim() ? <View className="gap-1">
          <Text className="font-sans text-caption text-secondary-foreground">Note</Text>
          <Text className="font-sans text-body text-foreground">{note.trim()}</Text>
        </View> : null
      ) : (
        <InputWithLabel label="Note" value={note} error={noteError} placeholder="Delivery instructions (optional)"
          multiline numberOfLines={3} textAlignVertical="top" maxLength={2000}
          inputClassName="min-h-[96px] py-3" disabled={busy} onChangeText={onNote} />
      ))}
      {locked && selected && (
        <View className="gap-2 border-t border-border pt-4">
          {estimate?.quoteId === selected.id ? (
            <MetadataList items={[
              { label: 'Estimated distance', value: `${(estimate.distanceMeters / 1000).toFixed(2)} km` },
              { label: 'Estimated time', value: `${Math.ceil(estimate.durationSeconds / 60)} min` },
            ]} />
          ) : null}
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-sans text-body text-foreground">Delivery fee</Text>
            <Text className="font-sans text-body font-semibold text-foreground">{formatPeso(selected.deliveryFee)}</Text>
          </View>
          <Text className="font-sans text-caption text-secondary-foreground">
            Actual tolls, if incurred, are billed after the rental.
          </Text>
          {!confirmed && <>
            <Text className="font-sans text-caption text-destructive" accessibilityRole="alert">
              Confirm the location again to refresh the delivery price.
            </Text>
            <Pressable disabled={busy || !mapReady} accessibilityRole="button"
              className="min-h-control items-center justify-center rounded-field bg-primary px-4 disabled:opacity-50"
              onPress={() => void confirmLocation()}>
              <Text className="font-sans text-body font-semibold text-surface">{busy ? 'Confirming Location...' : 'Reconfirm Location'}</Text>
            </Pressable>
          </>}
          <Pressable accessibilityRole="button" className="min-h-control justify-center" disabled={busy} onPress={invalidate}>
            <Text className="font-sans text-body font-semibold text-primary">Change details</Text>
          </Pressable>
        </View>
      )}
      {Object.entries(form.formState.errors).filter(([key]) => locked || key !== 'address').map(([key, value]) => (
          <Text key={key} accessibilityRole="alert" className="font-sans text-caption text-destructive">{value?.message}</Text>
      ))}
      {!locked && <>
        <Pressable disabled={busy || !point || !mapReady} accessibilityRole="button"
          className="min-h-control items-center justify-center rounded-field bg-primary px-4 disabled:opacity-50"
          onPress={() => void confirmLocation()}>
          <Text className="font-sans text-center text-body font-semibold text-surface">{busy ? 'Confirming Location...' : 'Confirm Location'}</Text>
        </Pressable>
      </>}
      {error && <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{error}</Text>}
    </View>
  );
}
