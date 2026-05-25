import { useRouter, type Href } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  Car,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Fuel,
  Gauge,
  Info,
  MapPinned,
  Navigation,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react-native';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  BookingEmptyState,
  BookingStatusBadge,
  BookingTimeline,
  InfoRow,
  PaymentStatusBadge,
  PricingBreakdown,
  SectionCard,
  getBookingActions,
  type BookingAction,
} from '@/components/bookings';
import { formatPeso, isTelematicsEnabled } from '@/lib/bookings/helpers';
import { getBookingById } from '@/lib/bookings/mock-data';
import type { Booking, DocumentStatus } from '@/types/booking';

import { cx } from '@/components/bookings/utils';

const documentStyles = {
  Submitted: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1D4ED8]',
    border: 'border-[#BFDBFE]',
  },
  Pending: {
    bg: 'bg-[#FFF7ED]',
    text: 'text-[#C2410C]',
    border: 'border-[#FED7AA]',
  },
  Missing: {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#B91C1C]',
    border: 'border-[#FECACA]',
  },
  Verified: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#047857]',
    border: 'border-[#BBF7D0]',
  },
} satisfies Record<DocumentStatus, { bg: string; text: string; border: string }>;

function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const styles = documentStyles[status];

  return (
    <View className={cx('rounded-full border px-2.5 py-1', styles.bg, styles.border)}>
      <Text className={cx('text-[10px] font-black', styles.text)}>{status}</Text>
    </View>
  );
}

function VehicleSpec({
  icon: Icon,
  label,
  value,
}: {
  label: string;
  value: string;
  icon: typeof Car;
}) {
  return (
    <View className="min-h-[82px] flex-1 basis-[47%] rounded-[22px] border border-[#EAF0FB] bg-[#F8FAFF] p-4">
      <Icon size={18} color="#346EF6" strokeWidth={2.35} />
      <Text className="mt-2 text-[10px] font-black uppercase text-[#91A0B8]">{label}</Text>
      <Text className="mt-1 text-[13px] font-black leading-5 text-[#17315F]" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DetailsActions({
  booking,
  onAction,
}: {
  booking: Booking;
  onAction: (action: BookingAction, booking: Booking) => void;
}) {
  const actions = getBookingActions(booking.status, { includeDetails: false });

  if (actions.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      {actions.map((action) => (
        <ActionButton
          key={action.key}
          icon={action.icon}
          label={action.label}
          variant={action.variant}
          onPress={() => onAction(action, booking)}
        />
      ))}
    </View>
  );
}

export function BookingDetailsScreen({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const booking = getBookingById(bookingId);

  const handleAction = (action: BookingAction, selectedBooking: Booking) => {
    if (action.key === 'open_telematics' && isTelematicsEnabled(selectedBooking.status)) {
      router.push('/telematics' as Href);
      return;
    }

    if (action.key === 'book_another_vehicle' || action.key === 'book_again') {
      router.push('/' as Href);
      return;
    }

    console.log(`Booking detail action tapped: ${action.key}`);
  };

  if (!booking) {
    return (
      <View className="flex-1 justify-center bg-[#F8FAFF] px-5">
        <BookingEmptyState
          title="Booking Not Found"
          subtitle="We could not find that booking in the mock data."
          buttonLabel="Back to Bookings"
          onBrowsePress={() => router.replace('/bookings' as Href)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFF]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never">
        <View className="px-5" style={{ paddingBottom: 34 + insets.bottom, paddingTop: insets.top + 10 }}>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-full border border-[#E6EEFF] bg-white">
              <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[25px] font-black leading-[30px] text-[#17315F]">Booking Details</Text>
              <Text className="mt-0.5 text-[13px] font-bold text-[#6C7A96]">{booking.id}</Text>
            </View>
            <BookingStatusBadge status={booking.status} compact />
          </View>

          <View className="mt-6 gap-5">
            <SectionCard title="Booking Overview" icon={ClipboardList}>
              <InfoRow label="Booking ID" value={booking.id} />
              <InfoRow label="Current Status" value={<BookingStatusBadge status={booking.status} compact />} />
              <InfoRow label="Created At" value={booking.createdAt} />
              <InfoRow label="Booking Type" value={booking.bookingType} />
            </SectionCard>

            <SectionCard title="Vehicle Information" icon={Car}>
              <Image
                source={{ uri: `${booking.image}?auto=format&fit=crop&w=1200&q=88` }}
                resizeMode="cover"
                className="mb-4 h-[178px] w-full rounded-[24px] bg-[#E9EFFA]"
              />
              <View className="mb-4 flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-[22px] font-black leading-[26px] text-[#10203F]">{booking.vehicleName}</Text>
                  <Text className="mt-1 text-[12px] font-bold text-[#6C7A96]">
                    {booking.brand} {booking.model}
                  </Text>
                </View>
                <Text className="text-right text-[17px] font-black text-[#346EF6]">
                  {formatPeso(booking.pricePerDay)}
                  <Text className="text-[11px] font-extrabold text-[#91A0B8]"> / day</Text>
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                <VehicleSpec icon={Car} label="Brand" value={booking.brand} />
                <VehicleSpec icon={ReceiptText} label="Model" value={booking.model} />
                <VehicleSpec icon={Info} label="Plate Number" value={booking.plateNumber} />
                <VehicleSpec icon={Gauge} label="Transmission" value={booking.transmission} />
                <VehicleSpec icon={Fuel} label="Fuel Type" value={booking.fuelType} />
                <VehicleSpec icon={Users} label="Seats" value={`${booking.seats}`} />
              </View>
            </SectionCard>

            <SectionCard title="Rental Schedule" icon={CalendarDays}>
              <InfoRow label="Rental Date" value={booking.rentalDate} />
              <InfoRow label="Return Date" value={booking.returnDate} />
              <InfoRow label="Duration" value={`${booking.duration} Days`} />
            </SectionCard>

            <SectionCard title="Pickup / Return Location" icon={MapPinned}>
              <InfoRow label="Pickup Type" value={booking.pickupType} />
              <InfoRow label="Pickup Location" value={booking.pickupLocation} />
              <InfoRow label="Return Location" value={booking.returnLocation} />
            </SectionCard>

            <SectionCard title="Driver Type and Documents" icon={ShieldCheck}>
              <InfoRow label="Driver Type" value={booking.driverType} />
              {booking.driverType === 'Self-Drive' ? (
                <View className="mt-3 gap-2">
                  <Text className="text-[12px] font-black uppercase text-[#91A0B8]">Required Documents</Text>
                  {booking.documents.map((document) => (
                    <View
                      key={document.name}
                      className="min-h-[50px] flex-row items-center justify-between gap-3 rounded-[18px] border border-[#EAF0FB] bg-[#F8FAFF] px-3 py-2">
                      <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <FileCheck2 size={16} color="#346EF6" strokeWidth={2.35} />
                        <Text className="min-w-0 flex-1 text-[13px] font-black text-[#17315F]">
                          {document.name}
                        </Text>
                      </View>
                      <DocumentStatusBadge status={document.status} />
                    </View>
                  ))}
                </View>
              ) : (
                <View className="mt-3 flex-row items-start gap-3 rounded-[22px] border border-[#DDE8FF] bg-[#F8FAFF] p-4">
                  <UserRound size={20} color="#346EF6" strokeWidth={2.35} />
                  <Text className="min-w-0 flex-1 text-[13px] font-bold leading-5 text-[#6C7A96]">
                    Owner&apos;s driver selected. Additional fees may apply outside Manila.
                  </Text>
                </View>
              )}
            </SectionCard>

            <SectionCard title="Pricing Breakdown" icon={ReceiptText}>
              <PricingBreakdown booking={booking} />
            </SectionCard>

            <SectionCard title="Payment Information" icon={CreditCard}>
              <InfoRow label="Payment Status" value={<PaymentStatusBadge status={booking.paymentStatus} />} />
              <InfoRow label="Payment Method" value={booking.paymentMethod} />
              <InfoRow label="Transaction ID" value={booking.transactionId} />
              <InfoRow label="Paid At" value={booking.paidAt} />
            </SectionCard>

            <SectionCard title="Status Timeline" icon={Navigation}>
              <BookingTimeline items={booking.timeline} />
            </SectionCard>

            <SectionCard title="Admin Notes" icon={Info}>
              <View className="rounded-[22px] border border-[#EAF0FB] bg-[#F8FAFF] p-4">
                <Text className="text-[13px] font-bold leading-5 text-[#6C7A96]">
                  {booking.adminNotes || 'No admin notes yet.'}
                </Text>
              </View>
            </SectionCard>

            <SectionCard title="Actions" icon={Navigation}>
              <DetailsActions booking={booking} onAction={handleAction} />
            </SectionCard>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
