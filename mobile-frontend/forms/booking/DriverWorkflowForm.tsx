import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings/ActionButton';
import { updateDriverWorkflow } from '@/services/api/driver-workflow.service';
import { ApiError } from '@/services/http';
import { driverWorkflowSchema, type DriverWorkflowInput } from '@/validation/booking/driver-workflow';
import type { Booking, DriverWorkflow } from '@/types/booking';

export function DriverWorkflowForm({ bookingId, bookingCode, workflow, pickupType, onUpdated }: {
  bookingId: number;
  bookingCode: string;
  workflow: DriverWorkflow;
  pickupType: 'Delivery' | 'Shop Pickup';
  onUpdated: (booking: Booking) => void | Promise<void>;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const { handleSubmit, setValue, formState: { isSubmitting } } = useForm<DriverWorkflowInput>({ resolver: zodResolver(driverWorkflowSchema) });
  const submit = handleSubmit(async (values) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError('');
    try {
      await onUpdated(await updateDriverWorkflow(bookingId, values));
    } catch (failure) {
      setError(failure instanceof ApiError
        ? failure.errors?.action?.[0] ?? failure.errors?.readiness?.[0] ?? failure.errors?.booking?.[0] ?? failure.message
        : 'This update could not be saved. Try again.');
    } finally {
      inFlight.current = false;
    }
  });
  const act = (action: DriverWorkflowInput['action']) => {
    setValue('action', action);
    if (action === 'start_rental') {
      Alert.alert('Start rental?', 'Confirm the vehicle is parked and ready to begin the rental.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Start rental', onPress: () => void submit() },
      ]);
    } else void submit();
  };
  return <View className="gap-2">
    <View className="flex-row flex-wrap gap-2">
      {workflow.status === 'assigned' ? <ActionButton className="min-w-0 flex-1" density="compact" label="On my way to pickup" disabled={isSubmitting || !workflow.canReportOnWay} onPress={() => act('on_way')} /> : null}
      {workflow.status === 'on_way' || (workflow.status === 'assigned' && pickupType === 'Shop Pickup') ? <ActionButton className="min-w-0 flex-1" density="compact" label="Arrived at pickup" disabled={isSubmitting || !workflow.canReportArrival} onPress={() => act('arrived')} /> : null}
      {workflow.status === 'arrived' && !workflow.setupComplete ? <ActionButton className="min-w-0 flex-1" density="compact" label="Begin setup" disabled={isSubmitting || !workflow.canBeginSetup} onPress={() => router.push(`/driver-telematics/${encodeURIComponent(bookingCode)}` as Href)} /> : null}
      {workflow.setupComplete ? <ActionButton className="min-w-0 flex-1" density="compact" variant="primary" label={isSubmitting ? 'Starting…' : 'Start rental'} disabled={isSubmitting || !workflow.canStartRental} onPress={() => act('start_rental')} /> : null}
    </View>
    {workflow.releaseBlocker ? <Text className="font-sans text-caption text-secondary-foreground">{workflow.releaseBlocker}</Text> : null}
    {error ? <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{error}</Text> : null}
  </View>;
}
