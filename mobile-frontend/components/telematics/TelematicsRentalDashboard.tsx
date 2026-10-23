import { ArrowUpRight, CalendarClock, CheckCircle2, Clock3, MapPin, Timer } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { VehicleImage } from '@/components/browse/BrowseComponents';
import { themeColors } from '@/constants/theme';
import { useRentalClock } from '@/hooks/telematics/useRentalClock';
import { formatRentalDate } from '@/lib/telematics/rental-card';
import { formatRentalDuration, rentalTiming, rentalVehicleName } from '@/lib/telematics/rental-dashboard';
import { RentalLocationMonitoring } from './RentalLocationMonitoring';
import type { MobileTelematicsHandover } from '@/services/api';
import type { Booking } from '@/types/booking';

export function TelematicsRentalDashboard({ handover, booking, onBookingDetails }: {
  handover: MobileTelematicsHandover;
  booking: Booking | undefined;
  onBookingDetails: () => void;
}) {
  const now = useRentalClock();
  const timing = rentalTiming(handover.setup?.releasedAt, booking?.rentalEndAt, now);
  const returnAt = booking?.rentalEndAt ? formatRentalDate(booking.rentalEndAt) : booking?.returnDate ?? 'Unavailable';
  const releaseAt = handover.setup?.releasedAt ? formatRentalDate(handover.setup.releasedAt) : 'Unavailable';

  return (
    <View className="gap-4">
      <View className="overflow-hidden rounded-card border border-border bg-surface">
        <View className="flex-row flex-wrap items-center justify-between gap-2 px-card pt-card">
          <Text className="font-sans text-caption text-secondary-foreground">{handover.bookingCode}</Text>
          <View className="flex-row items-center gap-1.5 rounded-full bg-success-surface px-3 py-2">
            <CheckCircle2 size={15} color={themeColors.success} accessible={false} />
            <Text className="font-sans text-caption font-semibold text-success">Rental ongoing</Text>
          </View>
        </View>
        <VehicleImage uri={booking?.image} resizeMode="contain" className="mx-card mt-3 h-44 rounded-field bg-background" accessibilityLabel={rentalVehicleName(booking)} />
        <View className="p-card">
          <Text className="font-sans text-title font-semibold text-foreground">{rentalVehicleName(booking)}</Text>
          {booking?.vehiclePlateNumber ? <Text className="font-sans mt-1 text-body text-secondary-foreground">{booking.vehiclePlateNumber}</Text> : null}
          <View className="mt-4 border-t border-border pt-3">
            <ActionButton label="Booking details" icon={ArrowUpRight} onPress={onBookingDetails} />
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[132px] flex-1 rounded-card bg-primary p-card">
          <View className="flex-row items-center gap-2"><Timer size={18} color={themeColors.surface} accessible={false} /><Text className="font-sans shrink text-caption text-surface">Since release</Text></View>
          <Text className="font-sans mt-3 text-title font-semibold text-surface" style={{ fontVariant: ['tabular-nums'] }}>{formatRentalDuration(timing.elapsedMs)}</Text>
        </View>
        <View className={`min-w-[132px] flex-1 rounded-card border p-card ${timing.returnDue ? 'border-warning-border bg-warning-surface' : 'border-border bg-surface'}`}>
          <View className="flex-row items-center gap-2"><Clock3 size={18} color={timing.returnDue ? themeColors.warning : themeColors.primary} accessible={false} /><Text className={`font-sans shrink text-caption ${timing.returnDue ? 'text-warning' : 'text-secondary-foreground'}`}>{timing.returnDue ? timing.overdueMs === 0 ? 'Return due' : 'Overdue by' : 'Until return'}</Text></View>
          <Text className={`font-sans mt-3 text-title font-semibold ${timing.returnDue ? 'text-warning' : 'text-foreground'}`} style={{ fontVariant: ['tabular-nums'] }}>{timing.returnDue && timing.overdueMs === 0 ? 'Now' : formatRentalDuration(timing.returnDue ? timing.overdueMs : timing.remainingMs)}</Text>
        </View>
      </View>

      <RentalLocationMonitoring key={handover.bookingCode} bookingCode={handover.bookingCode} />

      <SectionCard title="Rental schedule" icon={CalendarClock}>
        <InfoRow label="Released" value={releaseAt} />
        <InfoRow label="Return by" value={returnAt} />
        {booking?.returnLocation ? <View className="mt-3 flex-row items-start gap-2 border-t border-border pt-4">
          <MapPin accessible={false} size={18} color={themeColors.primary} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-sans text-caption text-secondary-foreground">Return location</Text>
            <Text className="font-sans text-body font-medium leading-6 text-foreground">{booking.returnLocation}</Text>
          </View>
        </View> : null}
      </SectionCard>
    </View>
  );
}
