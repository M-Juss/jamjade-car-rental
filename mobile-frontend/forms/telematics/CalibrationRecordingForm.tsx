import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { ApiError } from '@/services/http';
import { calibrationConsentSchema, type CalibrationConsentInput } from '@/validation/telematics/calibration';

export function CalibrationRecordingForm({ consent, onStart, disabled }: { consent: CalibrationConsentInput; onStart: (values: CalibrationConsentInput) => Promise<void>; disabled: boolean }) {
  const { handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CalibrationConsentInput>({
    resolver: zodResolver(calibrationConsentSchema),
    values: consent,
  });
  const submit = async (values: CalibrationConsentInput) => {
    try { await onStart(values); }
    catch (error) {
      if (error instanceof ApiError) {
        if (error.errors?.['evidence.consent']?.[0]) setError('consent', { message: error.errors['evidence.consent'][0] });
        if (error.errors?.['evidence.supervised']?.[0]) setError('supervised', { message: error.errors['evidence.supervised'][0] });
      }
      setError('root', { message: error instanceof ApiError
        ? error.errors?.step?.[0] ?? error.errors?.telematics_setup?.[0] ?? 'Calibration could not be saved. Refresh and repeat the current step while parked.'
        : error instanceof Error ? error.message : 'Calibration could not be completed. Try again while parked.' });
    }
  };
  return (
    <View className="gap-4">
      {errors.consent || errors.supervised ? <Text accessibilityLiveRegion="polite" className="font-sans text-caption leading-5 text-destructive">{errors.consent?.message ?? errors.supervised?.message}</Text> : null}
      {errors.root ? <Text accessibilityLiveRegion="polite" className="font-sans text-caption leading-5 text-destructive">{errors.root.message}</Text> : null}
      <ActionButton label={isSubmitting ? 'Starting calibration…' : 'Start recording'} variant="primary" disabled={disabled || isSubmitting} onPress={() => void handleSubmit(submit)()} />
    </View>
  );
}
