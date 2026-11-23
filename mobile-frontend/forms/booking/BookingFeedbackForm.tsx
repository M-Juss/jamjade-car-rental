import { zodResolver } from '@hookform/resolvers/zod';
import { Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { ActionButton } from '@/components/bookings/ActionButton';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { ProfileFormSheet } from '@/components/profile/ProfileFormSheet';
import { FormInput } from '@/components/ui/FormInput';
import { themeColors } from '@/constants/theme';
import { submitBookingFeedback } from '@/services/api/feedback.service';
import { ApiError } from '@/services/http';
import type { Booking, BookingFeedback } from '@/types/booking';
import { bookingFeedbackSchema, type BookingFeedbackInput } from '@/validation/booking/feedback';

export function BookingFeedbackForm({ booking, onClose, onSaved }: {
  booking: Booking; onClose: () => void; onSaved: (feedback: BookingFeedback) => void;
}) {
  const existing = booking.feedback;
  const vehicleTitle = [booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(' ');
  const bookingLabel = `${booking.id} (${vehicleTitle})`;
  const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<BookingFeedbackInput>({
    resolver: zodResolver(bookingFeedbackSchema), defaultValues: { rating: existing?.rating ?? 0, comment: existing?.comment ?? '' },
  });
  useEffect(() => {
    reset({ rating: existing?.rating ?? 0, comment: existing?.comment ?? '' });
  }, [booking.backendId, existing, reset]);
  const close = () => { if (!isSubmitting) onClose(); };
  const submit = async (values: BookingFeedbackInput) => {
    try { onSaved(await submitBookingFeedback(booking.backendId, values)); }
    catch (error) {
      if (error instanceof ApiError) {
        for (const [key, messages] of Object.entries(error.errors ?? {})) {
          if (key === 'rating' || key === 'comment') setError(key, { type: 'server', message: messages[0] });
        }
      }
      setError('root', { message: error instanceof ApiError && error.status === 409 ? 'Feedback was already submitted. Close and refresh this booking.' : error instanceof ApiError ? error.message : 'Feedback could not be confirmed. Retry or check this booking before trying again.' });
    }
  };

  return <ProfileFormSheet title={existing ? 'Your feedback' : 'Leave feedback'} visible onClose={close}>
    <KeyboardFormScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View className="gap-4">
        <Text numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={bookingLabel} className="font-sans text-body font-semibold text-foreground">{bookingLabel}</Text>
        <Controller control={control} name="rating" render={({ field, fieldState }) => <View className="gap-2">
          <Text className="font-sans text-caption font-medium text-foreground">Rating{!existing ? <Text className="text-destructive"> *</Text> : null}</Text>
          <View className="flex-row flex-wrap" accessibilityRole="radiogroup" accessibilityLabel="Rental rating">
            {[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="radio" accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ checked: field.value === star, disabled: Boolean(existing) || isSubmitting }} disabled={Boolean(existing) || isSubmitting}
              className="min-h-control min-w-12 items-center justify-center rounded-field" onPress={() => field.onChange(star)}>
              <Star size={30} color={star <= field.value ? themeColors.warning : themeColors.mutedForeground} fill={star <= field.value ? themeColors.warningBorder : 'none'} />
            </Pressable>)}
          </View>
          {fieldState.error ? <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{fieldState.error.message}</Text> : null}
        </View>} />
        {existing ? <Text className="font-sans text-body text-foreground">{existing.comment ?? 'No written feedback.'}</Text> : <Controller control={control} name="comment" render={({ field, fieldState }) => <FormInput label="Feedback (optional)" multiline numberOfLines={4} editable={!isSubmitting} value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />}
        {errors.root?.message ? <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{errors.root.message}</Text> : null}
        {!existing ? <ActionButton variant="primary" disabled={isSubmitting} label={isSubmitting ? 'Submitting…' : 'Submit feedback'} onPress={() => void handleSubmit(submit)()} /> : null}
        <ActionButton disabled={isSubmitting} label="Close" onPress={close} />
      </View>
    </KeyboardFormScrollView>
  </ProfileFormSheet>;
}
