import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings/ActionButton';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { ProfileFormSheet } from '@/components/profile/ProfileFormSheet';
import { FormInput } from '@/components/ui/FormInput';
import { cancelUnpaidBooking } from '@/services/api/booking.service';
import { ApiError } from '@/services/http';
import type { Booking } from '@/types/booking';
import { cancelUnpaidBookingSchema, type CancelUnpaidBookingInput } from '@/validation/booking/cancellation';

export function CancelBookingForm({ bookingId, visible, onClose, onCancelled }: {
  bookingId: string;
  visible: boolean;
  onClose: () => void;
  onCancelled: (booking: Booking) => void;
}) {
  const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CancelUnpaidBookingInput>({
    resolver: zodResolver(cancelUnpaidBookingSchema), defaultValues: { reason: '' },
  });

  useEffect(() => { reset({ reason: '' }); }, [bookingId, visible, reset]);

  const close = () => { if (!isSubmitting) onClose(); };
  const submit = async (values: CancelUnpaidBookingInput) => {
    try {
      const booking = await cancelUnpaidBooking(bookingId, values);
      onCancelled(booking);
    } catch (error) {
      if (error instanceof ApiError && error.errors?.reason?.[0]) {
        setError('reason', { type: 'server', message: error.errors.reason[0] });
      }
      const message = error instanceof ApiError && error.status === 422
        ? Object.values(error.errors ?? {}).flat()[0] ?? error.message
        : error instanceof ApiError && error.status === 403
          ? 'This booking can no longer be cancelled. Refresh its details.'
          : 'Cancellation could not be confirmed. Close this form and check the booking.';
      setError('root', { message });
    }
  };

  return (
    <ProfileFormSheet title="Cancel booking" visible={visible} onClose={close}>
      <KeyboardFormScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text className="font-sans mb-4 text-body text-secondary-foreground">This ends your unpaid booking.</Text>
        <Controller control={control} name="reason" render={({ field, fieldState }) => (
          <FormInput label="Reason" required multiline numberOfLines={4} editable={!isSubmitting}
            value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
        )} />
        {errors.root?.message ? (
          <Text accessibilityRole="alert" className="font-sans mt-3 text-caption text-destructive">{errors.root.message}</Text>
        ) : null}
        <View className="mt-section gap-2">
          <ActionButton disabled={isSubmitting} variant="danger" label={isSubmitting ? 'Cancelling…' : 'Cancel booking'}
            onPress={() => void handleSubmit(submit)()} />
          <ActionButton disabled={isSubmitting} label={errors.root ? 'Close' : 'Keep booking'} onPress={close} />
        </View>
      </KeyboardFormScrollView>
    </ProfileFormSheet>
  );
}
