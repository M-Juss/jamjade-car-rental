import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, FolderOpen, Smartphone } from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { type VehiclePreviewStep } from '@/lib/research/collection-workflow';
import { RC_COLLECTION_SURFACES, RC_SLOPES } from '@/lib/research/rc-research';
import { vehicleSetupPreviewSchema, type VehicleSetupPreviewInput } from '@/validation/research/vehicle-setup-preview';

// Deliberately receives no recorder, session-creation or upload callbacks.
export function VehicleSetupPreview({ step, onStepChange }: {
  step: VehiclePreviewStep;
  onStepChange: (step: VehiclePreviewStep) => void;
}) {
  const { control, trigger } = useForm<VehicleSetupPreviewInput>({
    resolver: zodResolver(vehicleSetupPreviewSchema),
    defaultValues: { surface: '', slope: 'level', orientation: 'portrait' },
  });
  const values = useWatch({ control });
  const slope = RC_SLOPES.find(option => option.value === values.slope)?.label ?? '';
  const orientation = values.orientation === 'landscape' ? 'Landscape' : 'Portrait';

  if (step === 'road') return <SectionCard density="compact" title="Road group" icon={FolderOpen}><View className="gap-3">
    <Controller control={control} name="surface" render={({ field, fieldState }) => <SelectWithLabel label="Road surface" required
      value={field.value} options={RC_COLLECTION_SURFACES} onValueChange={field.onChange} error={fieldState.error?.message} />} />
    <Controller control={control} name="slope" render={({ field }) => <SelectWithLabel label="Slope" value={field.value}
      options={RC_SLOPES} onValueChange={field.onChange} />} />
    <ActionButton density="compact" label="Continue" variant="primary" onPress={() => {
      void trigger(['surface', 'slope']).then(valid => { if (valid) onStepChange('session'); });
    }} />
  </View></SectionCard>;

  if (step === 'session') return <SectionCard density="compact" title="Session" icon={ClipboardList}><View className="gap-3">
    <View><InfoRow label="Road surface" value={values.surface ?? ''} /><InfoRow label="Slope" value={slope} />
      <InfoRow label="Session" value="New session preview" /></View>
    <Text className="font-sans text-caption text-secondary-foreground">Preview only. No group or session is saved.</Text>
    <ActionButton density="compact" label="Continue to phone mount" variant="primary" onPress={() => onStepChange('mount')} />
  </View></SectionCard>;

  if (step === 'mount') return <SectionCard density="compact" title="Phone mount" icon={Smartphone}><View className="gap-3">
    <InfoRow label="Mount" value="Phone holder" />
    <Controller control={control} name="orientation" render={({ field }) => <SelectWithLabel label="Holder orientation"
      value={field.value} onValueChange={field.onChange} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />} />
    <ActionButton density="compact" label="Review setup" variant="primary" onPress={() => onStepChange('review')} />
  </View></SectionCard>;

  return <SectionCard density="compact" title="Setup preview" icon={ClipboardList}><View className="gap-3">
    <View><InfoRow label="Road surface" value={values.surface ?? ''} /><InfoRow label="Slope" value={slope} />
      <InfoRow label="Mount" value={`Phone holder, ${orientation.toLowerCase()}`} />
      <InfoRow label="Stationary reference" value="Not captured" /><InfoRow label="Forward reference" value="Not captured" /></View>
    <Text accessibilityRole="alert" className="font-sans text-body text-secondary-foreground">Real-vehicle recording is not available yet.</Text>
    <ActionButton density="compact" label="Start recording" variant="primary" disabled />
  </View></SectionCard>;
}
