import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { locationConsentSchemaFor, type LocationConsentInput } from '@/validation/telematics/location-monitoring';

export function LocationSharingConsentForm({ version, disabled, onAgree, deferred = false }: { version: number; disabled: boolean; onAgree: (values: LocationConsentInput) => void; deferred?: boolean }) {
  const { handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LocationConsentInput>({
    resolver: zodResolver(locationConsentSchemaFor(version)), values: { consent: true, consent_version: version, sharing_mode: 'foreground_background' },
  });
  const submit = (mode: LocationConsentInput['sharing_mode']) => {
    setValue('sharing_mode', mode);
    void handleSubmit(onAgree)();
  };
  return <View className="gap-3">
    {errors.consent || errors.consent_version ? <Text accessibilityLiveRegion="polite" className="font-sans text-caption text-destructive">Refresh the rental before agreeing to location sharing.</Text> : null}
    <ActionButton label={deferred ? 'Agree and prepare background GPS' : 'Agree and share in background'} variant="primary" disabled={disabled || isSubmitting} onPress={() => submit('foreground_background')} />
    <ActionButton label={deferred ? 'Prepare GPS while app is open' : 'Share while app is open'} disabled={disabled || isSubmitting} onPress={() => submit('foreground')} />
  </View>;
}
