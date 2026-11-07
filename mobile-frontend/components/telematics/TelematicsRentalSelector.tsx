import { CheckCircle2, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, BookingStatusBadge } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import type { Booking } from '@/types/booking';

export function TelematicsRentalSelector({
  visible,
  rentals,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  rentals: Booking[];
  selectedCode?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-foreground/35" style={{ paddingTop: insets.top }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close rental selection" className="flex-1" onPress={onClose} />
        <View className="max-h-[85%] w-full max-w-[560px] self-center rounded-t-sheet bg-background px-screen pt-4" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="mb-4 flex-row items-center gap-3">
            <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-title font-semibold text-foreground">Choose rental</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close rental selection" className="h-11 w-11 items-center justify-center rounded-field bg-surface" onPress={onClose}>
              <X size={20} color={themeColors.foreground} />
            </Pressable>
          </View>
          <ScrollView className="shrink" contentContainerClassName="gap-3 pb-4">
            {rentals.map((rental) => (
              <Pressable
                key={rental.id}
                accessibilityRole="button"
                accessibilityLabel={`${rental.vehicleName}, ${rental.id}, ${rental.rentalDate}`}
                accessibilityState={{ selected: rental.id === selectedCode }}
                onPress={() => onSelect(rental.id)}
                className={`min-h-[72px] rounded-card border p-card ${rental.id === selectedCode ? 'border-primary bg-muted' : 'border-border bg-surface'}`}>
                <View className="flex-row items-center gap-3">
                  <Text className="font-sans min-w-0 flex-1 text-body font-semibold text-foreground">{rental.vehicleName}</Text>
                  {rental.id === selectedCode ? <CheckCircle2 size={20} color={themeColors.primary} /> : null}
                </View>
                <View className="mt-1 gap-0.5"><Text className="font-sans text-caption text-foreground">{rental.id}</Text><Text className="font-sans text-caption text-secondary-foreground">{rental.rentalDate}</Text></View>
                <View className="mt-3 self-start"><BookingStatusBadge status={rental.status} compact /></View>
              </Pressable>
            ))}
            <ActionButton label="Use current rental" onPress={() => onSelect('')} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
