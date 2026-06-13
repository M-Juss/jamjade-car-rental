import { CalendarDays, Clock3, MapPin, Navigation, ReceiptText, Tag } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { formatPeso, isTelematicsEnabled } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';

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
      <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-[#F3F7FF]">
        <Icon size={14} color="#346EF6" strokeWidth={2.45} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[10px] font-black uppercase text-[#91A0B8]">{label}</Text>
        <Text className="mt-0.5 text-[12px] font-bold leading-5 text-[#17315F]">{value}</Text>
      </View>
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
  const hasTelematics = isTelematicsEnabled(booking.status);
  const actions = getBookingActions(booking.status).filter(
    (action) =>
      action.key !== 'payment_info' &&
      !(hasTelematics && action.key === 'open_telematics'),
  );

  const handleAction = (action: BookingAction) => {
    if (action.key === 'view_details') {
      onViewDetails(booking);
      return;
    }

    onAction(action, booking);
  };

  return (
    <View className="overflow-hidden rounded-[30px] border border-[#E6EEFF] bg-white p-4 shadow-xl shadow-[#17315F]/10">
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${booking.id} details`} onPress={() => onViewDetails(booking)}>
        <Image
          source={{ uri: `${booking.image}?auto=format&fit=crop&w=1200&q=88` }}
          resizeMode="cover"
          className="h-[178px] w-full rounded-[24px] bg-[#E9EFFA]"
        />
      </Pressable>

      <View className="mt-4 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[22px] font-black leading-[26px] text-[#10203F]" numberOfLines={2}>
            {booking.vehicleName}
          </Text>
          <Text className="mt-1 text-[12px] font-bold text-[#6C7A96]">Booking ID: {booking.id}</Text>
        </View>
        <BookingStatusBadge status={booking.status} compact />
      </View>

      <View className="mt-4 gap-3">
        <DetailLine icon={CalendarDays} label="Rental Date" value={booking.rentalDate} />
        <DetailLine icon={Clock3} label="Return Date" value={booking.returnDate} />
        <DetailLine icon={MapPin} label="Pickup" value={booking.pickupLocation} />
      </View>

      {hasTelematics ? (
        <View className="mt-4 rounded-[24px] border border-[#BBF7D0] bg-[#ECFDF5] p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
              <Navigation size={20} color="#047857" strokeWidth={2.5} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-black text-[#065F46]">Telematics Enabled</Text>
              <Text className="mt-1 text-[12px] font-bold leading-5 text-[#047857]">
                This rental is active. You can now open the Telematics Tab to start or monitor your trip.
              </Text>
              <ActionButton
                className="mt-3 self-start"
                icon={Navigation}
                label="Open Telematics"
                variant="success"
                onPress={() =>
                  onAction(
                    {
                      key: 'open_telematics',
                      label: 'Open Telematics',
                      icon: Navigation,
                      variant: 'success',
                    },
                    booking,
                  )
                }
              />
            </View>
          </View>
        </View>
      ) : null}

      <View className="mt-5 flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <ReceiptText size={14} color="#91A0B8" strokeWidth={2.4} />
            <Text className="text-[11px] font-black uppercase text-[#91A0B8]">Total Amount</Text>
          </View>
          <Text className="mt-1 text-[23px] font-black text-[#17315F]">{formatPeso(booking.totalAmount)}</Text>
        </View>
        <View className="items-end gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Tag size={13} color="#91A0B8" strokeWidth={2.4} />
            <Text className="text-[10px] font-black uppercase text-[#91A0B8]">Payment</Text>
          </View>
          <PaymentStatusBadge status={booking.paymentStatus} />
        </View>
      </View>

      <View className="mt-5 flex-row flex-wrap gap-2">
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
