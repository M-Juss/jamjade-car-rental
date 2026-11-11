import { themeColors } from '@/constants/theme';
import { CalendarDays, Clock3, MapPin, CreditCard, Navigation } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatPeso } from '@/lib/bookings/helpers';
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
  audience = 'customer',
}: {
  booking: Booking;
  onViewDetails: (booking: Booking) => void;
  onAction: (action: BookingAction, booking: Booking) => void;
  audience?: 'customer' | 'driver';
}) {
  const vehicleTitle = [booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(' ');
  const isDriver = audience === 'driver';
  const driverBalance = booking.additionalCharges.reduce((total, charge) => total + charge.outstandingAmount, 0);
  const actions: BookingAction[] = isDriver ? [
    { key: 'view_details', label: 'View details', icon: CalendarDays, variant: 'secondary' },
    ...(['Confirmed', 'Active', 'Ongoing'].includes(booking.status) ? [{ key: 'open_telematics' as const, label: 'Telematics', icon: Navigation, variant: 'primary' as const }] : []),
    ...(driverBalance > 0 ? [{ key: 'pay_balance' as const, label: 'Pay charges', icon: CreditCard, variant: 'secondary' as const }] : []),
  ] : getBookingActions(booking.status, {
    isSelfDrive: booking.driverType === 'Self-Drive',
  }).filter(
    (action) => action.key !== 'payment_info' && action.key !== 'book_another_vehicle'
      && (action.key !== 'pay_balance' || booking.remainingBalance > 0),
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
          accessibilityLabel={`View ${booking.id}, ${vehicleTitle}, ${booking.status} details`}
          onPress={() => onViewDetails(booking)}
          className="min-w-0 flex-1 flex-row items-center gap-3">
          <VehicleImage
            uri={booking.image}
            resizeMode="contain"
            className="h-20 w-24 overflow-hidden rounded-field"
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-sans min-w-0 flex-1 text-[17px] font-semibold leading-[22px] text-foreground">
                {booking.id}
              </Text>
              <View className="shrink-0">
                <BookingStatusBadge status={booking.status} compact />
              </View>
            </View>
            <Text className="font-sans mt-1 text-[12px] text-secondary-foreground">{vehicleTitle}</Text>
          </View>
        </Pressable>
      </View>
      <View className="mt-3 gap-2">
        {isDriver && booking.customer?.name ? <Text className="font-sans text-body text-foreground">{booking.customer.name}</Text> : null}
        <DetailLine icon={CalendarDays} label="Rental" value={booking.rentalDate} />
        <DetailLine icon={Clock3} label="Return" value={booking.returnDate} />
        <DetailLine icon={MapPin} label="Pickup" value={booking.pickupLocation} />
      </View>
      {!isDriver ? <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <View>
          <Text className="font-sans text-[12px] text-secondary-foreground">Total amount</Text>
          <Text className="font-sans mt-0.5 text-[20px] font-semibold text-foreground">
            {formatPeso(booking.totalAmount)}
          </Text>
        </View>
        <PaymentStatusBadge status={booking.paymentStatus} />
      </View> : driverBalance > 0 ? <Text className="font-sans mt-3 text-caption font-medium text-foreground">Driver charges: {formatPeso(driverBalance)}</Text> : null}
      <View className="mt-3 flex-row flex-wrap items-stretch gap-2">
        {actions.map((action) => {
          const label = action.key === 'view_details' ? 'View details'
            : action.key === 'open_telematics' ? 'Telematics'
              : action.key === 'pay_balance' ? isDriver ? 'Pay charges' : 'Pay balance' : action.label;
          return <ActionButton
            key={action.key}
            accessibilityLabel={`${label} for ${booking.id}`}
            className={isDriver && actions.length > 2 ? 'min-w-[45%] flex-1' : 'min-w-0 flex-1'}
            density="compact"
            icon={action.icon}
            label={label}
            variant={action.key === 'view_details' ? 'secondary' : action.variant}
            onPress={() => handleAction(action)} />;
        })}
      </View>
    </View>
  );
}
