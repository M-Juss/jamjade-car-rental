import { Car, ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { SectionCard } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { canRecordTestVehicle, TEST_VEHICLES, type TestVehicle } from '@/lib/research/collection-workflow';

export function TestVehicleSelection({ disabled, onSelect }: {
  disabled: boolean;
  onSelect: (vehicle: TestVehicle) => void;
}) {
  return <SectionCard density="compact" title="Test vehicle" icon={Car}>
    {TEST_VEHICLES.map((vehicle, index) => <Pressable key={vehicle.id} accessibilityRole="button"
      accessibilityLabel={`${vehicle.label}, ${canRecordTestVehicle(vehicle.id) ? 'recording available' : 'setup preview'}`}
      accessibilityState={{ disabled }} disabled={disabled} onPress={() => onSelect(vehicle.id)}
      className={`min-h-[72px] flex-row items-center gap-3 py-3 ${index ? 'border-t border-border' : ''} ${disabled ? 'opacity-50' : ''}`}>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-sans text-body font-semibold text-foreground">{vehicle.label}</Text>
        <Text className="font-sans text-caption text-secondary-foreground">{canRecordTestVehicle(vehicle.id) ? 'Recording available' : 'Setup preview'}</Text>
      </View>
      <ChevronRight size={18} color={themeColors.primary} accessible={false} />
    </Pressable>)}
  </SectionCard>;
}
