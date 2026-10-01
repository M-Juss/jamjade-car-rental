import { useFocusEffect } from '@react-navigation/native';
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
  MapPinned,
  Navigation,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react-native';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
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
import { cancelBooking, getBooking } from '@/services/api';
import type { Booking, DocumentStatus } from '@/types/booking';

import { cx } from '@/components/bookings/utils';

const documentStyles = {
  Submitted: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1D4ED8]',
    border: 'border-[#BFDBFE]',
  },
  Pending: {
    bg: 'bg-warning-surface',
    text: 'text-warning',
    border: 'border-warning-border',
  },
  Missing: {
    bg: 'bg-destructive-surface',
    text: 'text-destructive',
    border: 'border-destructive-border',
  },
  Verified: {
    bg: 'bg-success-surface',
    text: 'text-success',
    border: 'border-success-border',
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
    <View className="min-h-[82px] flex-1 basis-[47%] rounded-[22px] border border-[#EAF0FB] bg-background p-4">
      <Icon size={18} color="#346EF6" strokeWidth={2.35} />
      <Text className="mt-2 text-[10px] font-black uppercase text-subtle-foreground">{label}</Text>
      <Text className="mt-1 text-[13px] font-black leading-5 text-foreground" numberOfLines={2}>
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
  const actions = getBookingActions(booking.status, { includeDetails: false, isSelfDrive: booking.driverType === 'Self-Drive' }).filter(
    (action) => action.key !== 'pay_balance' || booking.remainingBalance > 0,
  );
  const primaryActionKeys: BookingAction['key'][] = [
    'payment_info',
    'pay_balance',
    'open_telematics',
    'book_again',
    'book_another_vehicle',
  ];
  const primaryActions = actions.filter((action) => primaryActionKeys.includes(action.key));
  const supportingActions = actions.filter((action) => !primaryActionKeys.includes(action.key));

  if (actions.length === 0) {
    return null;
  }

  return (
    <View className="gap-4">
      {primaryActions.length > 0 ? (
        <View className="gap-3">
          {primaryActions.map((action) => (
            <ActionButton
              key={action.key}
              className="w-full"
              icon={action.icon}
              label={action.label}
              variant={action.variant}
              onPress={() => onAction(action, booking)}
            />
          ))}
        </View>
      ) : null}
      {supportingActions.length > 0 ? (
        <View className={cx('gap-3', primaryActions.length > 0 && 'border-t border-border pt-4')}>
          {primaryActions.length > 0 ? (
            <Text className="text-[11px] font-black uppercase tracking-[0.8px] text-subtle-foreground">More actions</Text>
          ) : null}
          {supportingActions.map((action) => (
            <ActionButton
              key={action.key}
              className="w-full"
              icon={action.icon}
              label={action.label}
              variant={action.variant}
              onPress={() => onAction(action, booking)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function BookingDetailsScreen({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      setBooking(await getBooking(bookingId));
    } catch {
      setLoadError('Booking could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void loadBooking();
    }, [loadBooking]),
  );

  const handleAction = (action: BookingAction, selectedBooking: Booking) => {
    if (action.key === 'pay_balance' || action.key === 'payment_info') {
      router.push(`/bookings/payment?bookingId=${encodeURIComponent(selectedBooking.id)}` as Href);
      return;
    }

    if (action.key === 'cancel_request') {
      Alert.alert(
        'Cancel booking?',
        'Captured payments are subject to the booking terms and are not automatically refunded.',
        [
          { text: 'Keep Booking', style: 'cancel' },
          {
            text: 'Cancel Booking',
            style: 'destructive',
            onPress: () => void cancelBooking(selectedBooking.id).then(setBooking),
          },
        ],
      );
      return;
    }

    if (action.key === 'open_telematics' && isTelematicsEnabled(selectedBooking)) {
      router.push(`/telematics?bookingId=${encodeURIComponent(selectedBooking.id)}` as Href);
      return;
    }

    if (action.key === 'book_another_vehicle' || action.key === 'book_again') {
      router.push('/' as Href);
      return;
    }

  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 justify-center bg-background px-5">
        <BookingEmptyState
          title="Booking Not Found"
          subtitle={loadError ?? 'We could not find that booking.'}
          buttonLabel="Back to Bookings"
          onBrowsePress={() => router.replace('/bookings' as Href)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never">
        <View className="px-5" style={{ paddingBottom: 34 + insets.bottom, paddingTop: insets.top + 10 }}>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface">
              <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[25px] font-black leading-[30px] text-foreground">Booking Details</Text>
              <Text className="mt-0.5 text-[13px] font-bold text-muted-foreground">{booking.id}</Text>
            </View>
            <BookingStatusBadge status={booking.status} compact />
          </View>

          <View className="mt-6 gap-5">
            <SectionCard title="Rental Progress" icon={Navigation}>
              {[
                ['Booking confirmed', booking.status !== 'Pending'],
                ['Outgoing inspection', booking.rentalProgress.outgoingFinalized],
                ['Telematics setup', ['ready_for_release', 'released'].includes(booking.telematicsSetupStatus ?? '')],
                ['Active rental', ['Active', 'Ongoing', 'Returned', 'Completed'].includes(booking.status)],
                ['Return inspection', booking.rentalProgress.incomingFinalized],
                ['Completed', booking.status === 'Completed'],
              ].map(([label, completed]) => (
                <View key={String(label)} className="flex-row items-center gap-3 border-b border-[#EEF2FF] py-3">
                  <View className={cx('h-7 w-7 items-center justify-center rounded-full', completed ? 'bg-success-surface' : 'bg-[#F1F5F9]')}>
                    <Text className={cx('text-[12px] font-black', completed ? 'text-success' : 'text-subtle-foreground')}>
                      {completed ? '✓' : '○'}
                    </Text>
                  </View>
                  <Text className="min-w-0 flex-1 text-[13px] font-bold text-foreground">{label}</Text>
                </View>
              ))}

              {booking.driverType === 'Self-Drive' && ['setup_required', 'in_progress'].includes(booking.telematicsSetupStatus ?? '') ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/telematics?bookingId=${encodeURIComponent(booking.id)}` as Href)}
                  className="mt-4 min-h-[52px] items-center justify-center rounded-full bg-primary px-5">
                  <Text className="text-[14px] font-black text-surface">View Telematics Setup</Text>
                </Pressable>
              ) : null}

              {booking.telematicsSetupStatus === 'ready_for_release' && booking.status === 'Confirmed' ? (
                <Text className="mt-4 rounded-[18px] border border-success-border bg-success-surface p-3 text-[12px] font-bold leading-5 text-success">
                  Telematics setup is ready. Waiting for Jamjade to start the rental.
                </Text>
              ) : null}

              {booking.rentalProgress.tripEnded && booking.status === 'Ongoing' ? (
                <Text className="mt-4 rounded-[18px] border border-warning-border bg-warning-surface p-3 text-[12px] font-bold leading-5 text-warning">
                  Trip ended. The booking remains active until Jamjade completes the Incoming Inspection and return process.
                </Text>
              ) : null}
            </SectionCard>

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
                  <Text className="mt-1 text-[12px] font-bold text-muted-foreground">
                    {booking.brand} {booking.model}
                  </Text>
                </View>
                <Text className="text-right text-[17px] font-black text-primary">
                  {formatPeso(booking.pricePerDay)}
                  <Text className="text-[11px] font-extrabold text-subtle-foreground"> / day</Text>
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                <VehicleSpec icon={Car} label="Brand" value={booking.brand} />
                <VehicleSpec icon={ReceiptText} label="Model" value={booking.model} />
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
              {booking.pickupType === 'Delivery' && booking.deliveryTime ? (
                <InfoRow label="Delivery Time" value={booking.deliveryTime} />
              ) : null}
            </SectionCard>

            <SectionCard title="Driver Type and Documents" icon={ShieldCheck}>
              <InfoRow label="Driver Type" value={booking.driverType} />
              {booking.driverType === 'Self-Drive' ? (
                <View className="mt-3 gap-2">
                  <Text className="text-[12px] font-black uppercase text-subtle-foreground">Required Documents</Text>
                  {booking.documents.map((document) => (
                    <View
                      key={document.name}
                      className="min-h-[50px] flex-row items-center justify-between gap-3 rounded-[18px] border border-[#EAF0FB] bg-background px-3 py-2">
                      <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <FileCheck2 size={16} color="#346EF6" strokeWidth={2.35} />
                        <Text className="min-w-0 flex-1 text-[13px] font-black text-foreground">
                          {document.name}
                        </Text>
                      </View>
                      <DocumentStatusBadge status={document.status} />
                    </View>
                  ))}
                </View>
              ) : (
                <View className="mt-3 flex-row items-start gap-3 rounded-[22px] border border-border bg-background p-4">
                  <UserRound size={20} color="#346EF6" strokeWidth={2.35} />
                  <Text className="min-w-0 flex-1 text-[13px] font-bold leading-5 text-muted-foreground">
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
              {booking.balanceDueAt ? (
                <InfoRow
                  label="Balance Due"
                  value={new Date(booking.balanceDueAt).toLocaleString()}
                />
              ) : null}
            </SectionCard>

            {booking.additionalCharges.length > 0 ? (
              <SectionCard title="Additional Charges" icon={ReceiptText}>
                {booking.additionalCharges.map((charge) => (
                  <View key={charge.id} className="border-b border-[#EEF2FF] py-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="text-[13px] font-black text-foreground">{charge.typeLabel}</Text>
                        <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">{charge.description}</Text>
                      </View>
                      <Text className="text-[14px] font-black text-foreground">{formatPeso(charge.amount)}</Text>
                    </View>
                    <Text className="mt-2 text-[10px] font-black uppercase text-subtle-foreground">{charge.paymentStatus}</Text>
                  </View>
                ))}
              </SectionCard>
            ) : null}

            <SectionCard title="Status Timeline" icon={Navigation}>
              <BookingTimeline items={booking.timeline} />
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
