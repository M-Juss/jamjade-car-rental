import { ScrollView, Text, View } from 'react-native';
import { Armchair, CalendarDays, Car, Cog, CreditCard, Fuel, MapPinned, Navigation, Palette, ReceiptText } from 'lucide-react-native';
import { BookingTimeline, InfoRow, PaymentStatusBadge, PricingBreakdown, SectionCard } from '@/components/bookings';
import { DeliveryLocationDetails } from '@/components/bookings/DeliveryLocationDetails';
import { BookingReceipts } from '@/components/payments/BookingReceipts';
import { TelematicsMap } from '@/components/telematics/TelematicsMap';
import { VehicleImage } from '@/components/browse/BrowseComponents';
import { cx } from '@/components/bookings/utils';
import { themeColors } from '@/constants/theme';
import { formatPeso } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';

export function BookingDetailsContent({ booking }: { booking: Booking }) {
  return <View className="gap-4">
    <SectionCard title="Vehicle Information" icon={Car}>
              <VehicleImage
                uri={booking.image}
                accessibilityLabel={[booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(' ')}
        resizeMode="cover"
        className="mb-4 h-[140px] w-full rounded-card bg-muted"
      />
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[22px] font-semibold leading-[26px] text-foreground">
            {[booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(" ")}
          </Text>
        </View>
        <Text className="font-sans text-right text-[17px] font-semibold text-primary">
          {formatPeso(booking.pricePerDay)}
          <Text className="text-[11px] font-normal text-secondary-foreground">
            {" "}
            / day
          </Text>
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", columnGap: 12 }}
      >
        {[
          { icon: Palette, label: "Color", value: booking.color || "Not specified" },
          { icon: Armchair, label: "Seats", value: `${booking.seats} seater` },
          { icon: Cog, label: "Transmission", value: booking.transmission },
          { icon: Fuel, label: "Fuel type", value: booking.fuelType === "Gasoline" ? "Gas" : booking.fuelType },
        ].map(({ icon: Icon, label, value }, index, specs) => (
          <View
            key={label}
            accessible
            accessibilityLabel={`${label}: ${value}`}
            className={cx(
              "shrink-0 flex-row items-center gap-1.5",
              index < specs.length - 1 && "border-r border-border pr-3",
            )}
          >
            <Icon accessible={false} size={16} color={themeColors.primary} strokeWidth={2.35} />
            <Text numberOfLines={1} className="font-sans text-[12px] font-semibold text-foreground">
              {value}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SectionCard>

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
      {booking.deliveryLocation && (
        <DeliveryLocationDetails booking={booking} />
      )}
    </SectionCard>

    {booking.sharedVehicleLocation ? <SectionCard title="Vehicle location" icon={Navigation}>
      <InfoRow label="Last shared" value={new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(booking.sharedVehicleLocation.sharedAt))} />
      <View className="mt-3 h-[220px] overflow-hidden rounded-card">
        <TelematicsMap point={{ ...booking.sharedVehicleLocation, captured_at: booking.sharedVehicleLocation.sharedAt }} recenter={0} />
      </View>
    </SectionCard> : null}

    <SectionCard title="Pricing Breakdown" icon={ReceiptText}>
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

    <BookingReceipts key={booking.id} bookingReference={booking.id} />

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

