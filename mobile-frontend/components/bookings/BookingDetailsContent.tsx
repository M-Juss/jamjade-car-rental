import { Text, View } from 'react-native';
import { CalendarDays, Car, CreditCard, MapPinned, Navigation, ReceiptText, UserRound } from 'lucide-react-native';
import { BookingTimeline, InfoRow, PaymentStatusBadge, PricingBreakdown, SectionCard } from '@/components/bookings';
import { DeliveryLocationDetails } from '@/components/bookings/DeliveryLocationDetails';
import { DeliveryLocationLink } from '@/components/bookings/DeliveryLocationLink';
import { DeliveryPointMap } from '@/components/bookings/DeliveryPointMap';
import { BookingReceipts } from '@/components/payments/BookingReceipts';
import { TelematicsMap } from '@/components/telematics/TelematicsMap';
import { VehicleSummaryContent } from '@/components/browse/BrowseComponents';
import { formatPeso } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';

export function BookingDetailsContent({ booking, audience = 'customer' }: { booking: Booking; audience?: 'customer' | 'driver' }) {
  const isDriver = audience === 'driver';
  return <View className="gap-4">
    <SectionCard title="Vehicle Information" icon={Car}>
      <VehicleSummaryContent title={[booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(' ')}
        image={booking.image} pricePerDay={booking.pricePerDay} hidePrice={isDriver} color={booking.color}
        seats={booking.seats} transmission={booking.transmission} fuelType={booking.fuelType} />
    </SectionCard>

    {isDriver ? <SectionCard title="Customer" icon={UserRound}>
      <InfoRow label="Name" value={booking.customer?.name || 'Not provided'} />
      <InfoRow label="Contact number" value={booking.customer?.phoneNumber || 'Not provided'} />
    </SectionCard> : null}

    <SectionCard title="Rental Schedule" icon={CalendarDays}>
      <InfoRow label="Rental Date" value={booking.rentalDate} />
      <InfoRow label="Return Date" value={booking.returnDate} />
      <InfoRow label="Duration" value={`${booking.duration} Days`} />
    </SectionCard>

    <SectionCard title="Pickup / Return Location" icon={MapPinned}>
      <InfoRow label="Pickup Type" value={booking.pickupType} />
      {booking.pickupType === "Delivery" && booking.deliveryTime ? (
        <InfoRow label="Delivery Time" value={booking.deliveryTime} />
      ) : null}
      <InfoRow label="Pickup Location" value={booking.pickupLocation} />
      {booking.notes && !booking.deliveryLocation ? <InfoRow label="Note" value={booking.notes} /> : null}
      {booking.deliveryLocation && !isDriver && (
        <DeliveryLocationDetails booking={booking} />
      )}
      {booking.deliveryLocation && isDriver ? <View className="mt-3 gap-3">
        {booking.deliveryLocation.point ? <DeliveryPointMap point={booking.deliveryLocation.point} /> : null}
        {booking.notes ? <InfoRow label="Note" value={booking.notes} /> : null}
        <DeliveryLocationLink location={booking.deliveryLocation} navigate />
      </View> : null}
      {isDriver ? <InfoRow label="Return location" value={booking.returnLocation} /> : null}
    </SectionCard>

    {booking.sharedVehicleLocation ? <SectionCard title="Vehicle location" icon={Navigation}>
      <InfoRow label="Last shared" value={new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(booking.sharedVehicleLocation.sharedAt))} />
      <View className="mt-3 h-[220px] overflow-hidden rounded-card">
        <TelematicsMap point={{ ...booking.sharedVehicleLocation, captured_at: booking.sharedVehicleLocation.sharedAt }} recenter={0} />
      </View>
    </SectionCard> : null}

    {!isDriver ? <><SectionCard title="Pricing Breakdown" icon={ReceiptText}>
      <PricingBreakdown booking={booking} />
    </SectionCard>

    <SectionCard title="Payment Information" icon={CreditCard}>
      <InfoRow
        label="Payment Status"
        value={<PaymentStatusBadge status={booking.paymentStatus} />}
      />
      <InfoRow label="Payment Method" value={booking.paymentMethod} />
      <InfoRow label="Transaction ID" value={booking.transactionId} />
      <InfoRow label="Paid At" value={booking.paidAt} />
      {booking.balanceDueAt ? (
        <InfoRow
          label="Pay balance before"
          value={new Date(booking.balanceDueAt).toLocaleString(
            "en-PH",
            { timeZone: "Asia/Manila" },
          )}
        />
      ) : null}
    </SectionCard>

    <BookingReceipts key={booking.id} bookingReference={booking.id} /></> : null}

    {booking.cancellation ? (
      <SectionCard title="Cancellation and refund" icon={ReceiptText}>
        <InfoRow label="Reason" value={booking.cancellation.reason} />
        <InfoRow
          label="Refund status"
          value={booking.cancellation.refundStatus.replaceAll("_", " ")}
        />
        {booking.cancellation.refundAmount !== null ? (
          <InfoRow
            label="Approved refund"
            value={formatPeso(booking.cancellation.refundAmount)}
          />
        ) : null}
        {booking.cancellation.refundReason ? (
          <InfoRow
            label="Decision"
            value={booking.cancellation.refundReason}
          />
        ) : null}
        {booking.cancellation.refundedAt ? (
          <InfoRow
            label="Money returned"
            value={new Date(
              booking.cancellation.refundedAt,
            ).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
          />
        ) : null}
      </SectionCard>
    ) : null}

    {booking.additionalCharges.length > 0 ? (
      <SectionCard title="Additional Charges" icon={ReceiptText}>
        {booking.additionalCharges.map((charge) => (
          <View
            key={charge.id}
            className="border-b border-[#EEF2FF] py-3"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-[13px] font-semibold text-foreground">
                  {charge.typeLabel}
                </Text>
                <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">
                  {charge.description}
                </Text>
              </View>
              <Text className="font-sans text-[14px] font-semibold text-foreground">
                {formatPeso(charge.amount)}
              </Text>
            </View>
            <Text className="font-sans mt-2 text-[11px] font-normal text-secondary-foreground">
              {charge.paymentStatus}
            </Text>
          </View>
        ))}
      </SectionCard>
    ) : null}

    <SectionCard title="Status Timeline" icon={Navigation}>
      <BookingTimeline items={booking.timeline} />
    </SectionCard>
  </View>;
}

