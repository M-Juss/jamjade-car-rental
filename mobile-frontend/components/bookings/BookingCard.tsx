import { themeColors } from '@/constants/theme';
import { CalendarDays, Clock3, MapPin, Navigation } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatPeso, isTelematicsEnabled } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';

import { VehicleImage } from '@/components/browse/BrowseComponents';

import { ActionButton } from './ActionButton';
import { getBookingActions, type BookingAction } from './booking-actions';
import { BookingStatusBadge } from './BookingStatusBadge';
import { PaymentStatusBadge } from './PaymentStatusBadge';

function DetailLine({
  icon: Icon,
  label,
  value,
}: {
  label: string;
  value: string;
  icon: typeof CalendarDays;
}) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon size={15} color={themeColors.primary} strokeWidth={2} />
      <Text className="font-sans w-12 text-[13px] leading-[18px] text-secondary-foreground">{label}</Text>
      <Text className="font-sans min-w-0 flex-1 text-[13px] leading-[18px] text-foreground">{value}</Text>
    </View>
  );
}

export function BookingCard({
  booking,
  onAction,
  onViewDetails,
}: {
  booking: Booking;
  onViewDetails: (booking: Booking) => void;
  onAction: (action: BookingAction, booking: Booking) => void;
}) {
  const hasTelematics = isTelematicsEnabled(booking);
  const actions = getBookingActions(booking.status, {
    isSelfDrive: booking.driverType === 'Self-Drive',
  }).filter(
    (action) => action.key !== 'payment_info' && !(hasTelematics && action.key === 'open_telematics'),
  );

  const handleAction = (action: BookingAction) => {
    if (action.key === 'view_details') {
      onViewDetails(booking);
      return;
    }

    onAction(action, booking);
  };

  return (
    <View className="rounded-card border border-border bg-surface p-card">
      <View className="flex-row items-start gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${booking.id} details`}
          onPress={() => onViewDetails(booking)}
          className="min-w-0 flex-1 flex-row items-center gap-3">
          <VehicleImage
            uri={booking.image}
            resizeMode="contain"
            className="h-20 w-24 overflow-hidden rounded-field bg-background"
          />
          <View className="min-w-0 flex-1">
            <Text
              className="font-sans text-[17px] font-semibold leading-[22px] text-foreground"
              numberOfLines={2}>
              {booking.vehicleName}
            </Text>
            <Text className="font-sans mt-1 text-[12px] text-secondary-foreground">{booking.id}</Text>
            <View className="mt-2 self-start">
              <BookingStatusBadge status={booking.status} compact />
            </View>
          </View>
        </Pressable>
      </View>
      <View className="mt-3 gap-2">
        <DetailLine icon={CalendarDays} label="Rental" value={booking.rentalDate} />
        <DetailLine icon={Clock3} label="Return" value={booking.returnDate} />
        <DetailLine icon={MapPin} label="Pickup" value={booking.pickupLocation} />
      </View>
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <View>
          <Text className="font-sans text-[12px] text-secondary-foreground">Total amount</Text>
          <Text className="font-sans mt-0.5 text-[20px] font-semibold text-foreground">
            {formatPeso(booking.totalAmount)}
          </Text>
        </View>
        <PaymentStatusBadge status={booking.paymentStatus} />
      </View>
      {hasTelematics ? (
        <View className="mt-3 rounded-field bg-success-surface p-3">
          <Text className="font-sans mb-2 text-[13px] text-success">Your self-drive rental is active.</Text>
          <ActionButton
            icon={Navigation}
            label="Open Telematics"
            variant="success"
            onPress={() =>
              onAction(
                { key: 'open_telematics', label: 'Open Telematics', icon: Navigation, variant: 'success' },
                booking,
              )
            }
          />
        </View>
      ) : null}
      <View className="mt-3 flex-row flex-wrap gap-2">
        {actions.map((action) => (
          <ActionButton
            key={action.key}
            className="flex-grow"
            icon={action.icon}
            label={action.label}
            variant={action.variant}
            onPress={() => handleAction(action)}
          />
        ))}
      </View>
    </View>
  );
}
