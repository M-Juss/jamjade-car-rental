import { Smartphone } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { NATIVE_MOUNT_METHOD } from '@/lib/research/native-recorder';

export function CollectionMountSetup({ mountNumber, disabled, onContinue }: {
  mountNumber: number;
  disabled: boolean;
  onContinue: () => void;
}) {
  return <SectionCard density="compact" title="Phone mount" icon={Smartphone}>
    <View className="gap-3">
      <View>
        <InfoRow label="Mount version" value={mountNumber} />
        <InfoRow label="Holder" value={NATIVE_MOUNT_METHOD} />
        <InfoRow label="Position" value="Screen up, top toward RC front" />
      </View>
      <Text className="font-sans text-caption text-secondary-foreground">Secure the holder before running setup checks.</Text>
      <ActionButton density="compact" label="Continue to setup" variant="primary" disabled={disabled} onPress={onContinue} />
    </View>
  </SectionCard>;
}
