import { Image } from 'expo-image';
import { ArrowRight, LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { VehicleImage } from '@/components/browse/BrowseComponents';
import { themeColors } from '@/constants/theme';
import { getVehicleImageSource } from '@/lib/browse/vehicle-image-source';
import { formatRentalDateCompact, rentalCardState } from '@/lib/telematics/rental-card';
import type { MobileTelematicsRental } from '@/services/api';

export function TelematicsRentalCard({ rental, unavailable, onOpen, onDetails, onDocuments }: {
  rental: MobileTelematicsRental;
  unavailable: boolean;
  onOpen: () => void;
  onDetails: () => void;
  onDocuments: () => void;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const state = rentalCardState(rental);
  const status = unavailable ? 'Refresh required' : state.status;
  const description = unavailable ? 'Refresh rentals to check availability.' : state.description;
  const disabled = unavailable || !state.canOpen;
  const label = disabled ? status : state.action;
  const Icon = disabled ? LockKeyhole : ArrowRight;
  return (
    <View className="w-full max-w-[440px] self-center overflow-hidden rounded-card border border-border bg-surface">
      <View className="px-card pt-card">
        <View className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <Text className="font-sans min-w-0 flex-1 text-[20px] font-semibold leading-6 text-foreground">{rental.vehicleName || 'Your vehicle'}</Text>
          <Text className="font-sans text-right text-caption font-semibold text-primary">{rental.bookingCode}</Text>
        </View>
        <View className="mt-3 h-32 w-full">
          {rental.image && failedImage !== rental.image ? <Image
            source={getVehicleImageSource(rental.image)}
            accessibilityLabel={rental.vehicleName}
            contentFit="contain"
            contentPosition="bottom"
            onError={() => setFailedImage(rental.image)}
            style={{ width: '100%', height: '100%' }}
          /> : <VehicleImage uri={null} className="h-full w-full" accessibilityLabel={rental.vehicleName} />}
        </View>
      </View>
      <View className="gap-3 border-t border-border bg-surface p-card">
        <View className="flex-row items-start gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-caption text-secondary-foreground">Rental date</Text>
            <Text className="font-sans text-caption font-medium text-foreground">{formatRentalDateCompact(rental.rentalStartAt)}</Text>
          </View>
          <View className="min-w-0 flex-1 items-end">
            <Text className="font-sans text-caption text-secondary-foreground">Return</Text>
            <Text className="font-sans text-right text-caption font-medium text-foreground">{formatRentalDateCompact(rental.rentalEndAt)}</Text>
          </View>
        </View>
        <View className="h-px bg-border" accessibilityElementsHidden />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} for ${rental.bookingCode}`}
          accessibilityHint={disabled ? description ?? undefined : undefined}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onOpen}
          className={`min-h-control justify-center gap-1.5 rounded-field border px-4 py-3 ${disabled ? 'border-border bg-muted' : 'border-primary bg-primary'}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <View className="flex-row items-center justify-center gap-2">
            <Icon size={17} color={disabled ? themeColors.secondaryForeground : themeColors.surface} />
            <Text className={`font-sans shrink text-center text-button font-medium ${disabled ? 'text-secondary-foreground' : 'text-surface'}`}>{label}</Text>
          </View>
          {disabled && description ? <Text className="font-sans text-center text-caption text-secondary-foreground">{description}</Text> : null}
        </Pressable>
        <ActionButton label="Booking details" accessibilityLabel={`Booking details for ${rental.bookingCode}`} onPress={onDetails} />
        {rental.eligibility.state === 'verification_required' ? <Pressable accessibilityRole="button" onPress={onDocuments} className="min-h-control items-center justify-center">
          <Text className="font-sans text-body font-medium text-primary">Review documents</Text>
        </Pressable> : null}
      </View>
    </View>
  );
}
