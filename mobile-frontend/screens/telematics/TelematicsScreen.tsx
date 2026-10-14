import { floatingTabBarContentPadding } from '@/constants/layout';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  CalendarDays,
  Car,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  CreditCard,
  FileCheck2,
  MapPin,
  Navigation,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react-native';
import { useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  BookingEmptyState,
  BookingStatusBadge,
  InfoRow,
  SectionCard,
} from '@/components/bookings';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { TelematicsSetupChecklist } from '@/components/telematics/TelematicsSetupChecklist';
import { themeColors } from '@/constants/theme';
import { useTelematicsHandover } from '@/hooks/telematics/useTelematicsHandover';
import { formatPeso } from '@/lib/bookings/helpers';
import { canSelectTelematicsBooking, handoverStatusCopy, isDeviceSetupStep } from '@/lib/telematics/setup';

export function TelematicsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = (Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId) || undefined;
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const { handover, bookings, loading, loadError, bookingsError, actingStep, feedback, refresh, checkSetup } =
    useTelematicsHandover(bookingId);
  const rentals = bookings.filter(canSelectTelematicsBooking);
  const booking = handover ? bookings.find((item) => item.id === handover.bookingCode) : undefined;
  const statusCopy = handover ? handoverStatusCopy(handover) : null;
  const busy = actingStep !== null;
  const navigateToBooking = () => {
    if (handover) router.push(`/bookings/${encodeURIComponent(handover.bookingCode)}` as Href);
  };
  const selectBooking = (id: string) => {
    if (busy) return;
    router.setParams({ bookingId: id });
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const confirmPhoneMount = () =>
    new Promise<boolean | null>((resolve) => {
      Alert.alert(
        'Confirm phone mount',
        'While safely parked, confirm that the phone is securely mounted upright with the screen facing the driver. This is your confirmation; the app does not detect the holder.',
        [
          { text: 'Not yet', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm mount', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(null) },
      );
    });

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
            enabled={!busy}
          />
        }>
        <View className="px-5" style={{ paddingTop: insets.top + 10, paddingBottom: floatingTabBarContentPadding + insets.bottom }}>
          <CustomerTabHeader title="Telematics" />
          <View className="mt-2 flex-row items-center justify-between gap-3">
            <Text className="font-sans min-w-0 flex-1 text-[13px] font-medium leading-5 text-secondary-foreground">
              Manage your self-drive handover and setup.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || loading }}
              disabled={busy || loading}
              className="min-h-[44px] justify-center px-1 disabled:opacity-50"
              onPress={() => void refresh()}>
              <Text className="font-sans text-[12px] font-medium text-primary">Refresh</Text>
            </Pressable>
          </View>

          <View className="mt-4 gap-5">
            {bookingsError ? (
              <View className="rounded-[24px] border border-warning-border bg-warning-surface p-4">
                <Text className="font-sans text-[13px] font-medium leading-5 text-warning">
                  {bookingsError}
                </Text>
              </View>
            ) : null}

            {rentals.length > 0 || bookingId ? (
              <SectionCard title="Self-drive bookings" icon={Car}>
                <Text className="font-sans mb-3 text-[12px] font-normal leading-5 text-secondary-foreground">
                  Select a confirmed or active rental. Setup availability is checked with JamJade.
                </Text>
                <View className="gap-2">
                  {rentals.map((rental) => {
                    const selected = rental.id === handover?.bookingCode || rental.id === bookingId;
                    return (
                      <Pressable
                        key={rental.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${rental.id}, ${rental.vehicleName}`}
                        accessibilityState={{ selected, disabled: busy || Boolean(bookingsError) }}
                        disabled={busy || Boolean(bookingsError)}
                        onPress={() => selectBooking(rental.id)}
                        className={`min-h-[64px] flex-row items-center gap-3 rounded-[18px] border p-3 ${selected ? 'border-primary bg-muted' : 'border-border bg-background'} ${busy ? 'opacity-50' : ''}`}>
                        <View className="min-w-0 flex-1">
                          <Text className="font-sans text-[13px] font-semibold text-foreground">
                            {rental.vehicleName}
                          </Text>
                          <Text className="font-sans mt-1 text-[11px] font-medium text-secondary-foreground">
                            {rental.id} · {rental.rentalDate}
                          </Text>
                        </View>
                        {selected ? <CheckCircle2 size={18} color={themeColors.primary} /> : null}
                        <BookingStatusBadge status={rental.status} compact />
                      </Pressable>
                    );
                  })}
                  {bookingId ? (
                    <ActionButton
                      label="Return to current rental"
                      icon={RefreshCcw}
                      variant="soft"
                      disabled={busy || loading}
                      onPress={() => selectBooking('')}
                    />
                  ) : null}
                </View>
              </SectionCard>
            ) : null}

            {loading ? (
              <View className="items-center rounded-card border border-border bg-surface p-8">
                <ActivityIndicator color={themeColors.primary} />
                <Text className="font-sans mt-3 text-[13px] font-medium text-secondary-foreground">
                  Loading telematics…
                </Text>
              </View>
            ) : loadError ? (
              <SectionCard title="Telematics unavailable" icon={CircleAlert}>
                <Text className="font-sans mb-4 text-[13px] font-normal leading-5 text-secondary-foreground">
                  {loadError}
                </Text>
                <ActionButton
                  label="Try again"
                  variant="primary"
                  icon={RefreshCcw}
                  onPress={() => void refresh()}
                />
              </SectionCard>
            ) : !handover ? (
              <BookingEmptyState
                title="No self-drive rental"
                subtitle="Your self-drive booking’s handover and setup will appear here. Rentals with an assigned driver do not need telematics setup."
              />
            ) : (
              <>
                <SectionCard title="Your rental" icon={Car}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans text-[17px] font-semibold text-foreground">
                        {booking?.vehicleName ?? handover.bookingCode}
                      </Text>
                      <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                        {handover.bookingCode}
                      </Text>
                    </View>
                    <BookingStatusBadge
                      status={
                        handover.bookingStatus === 'ongoing'
                          ? 'Active'
                          : handover.bookingStatus === 'confirmed'
                            ? 'Confirmed'
                            : 'Pending'
                      }
                      compact
                    />
                  </View>
                  <View className="mt-3">
                    <InfoRow
                      label="Pickup"
                      value={
                        booking?.rentalDate ??
                        (handover.rentalStartAt
                          ? new Date(handover.rentalStartAt).toLocaleString('en-PH', {
                              timeZone: 'Asia/Manila',
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Not scheduled')
                      }
                    />
                    {booking ? (
                      <>
                        <InfoRow label="Return" value={booking.returnDate} />
                        <InfoRow label="Pickup location" value={booking.pickupLocation} />
                        <InfoRow label="Payment" value={booking.paymentStatus} />
                        <InfoRow label="Remaining balance" value={formatPeso(booking.remainingBalance)} />
                      </>
                    ) : null}
                  </View>
                  <View className="mt-3 gap-2">
                    <ActionButton
                      label="View booking details"
                      icon={ClipboardList}
                      onPress={navigateToBooking}
                    />
                    {booking && canSelectTelematicsBooking(booking) && booking.remainingBalance > 0 ? (
                      <ActionButton
                        label="Review payment"
                        icon={CreditCard}
                        variant="soft"
                        onPress={() =>
                          router.push(
                            `/bookings/payment?bookingId=${encodeURIComponent(handover.bookingCode)}` as Href,
                          )
                        }
                      />
                    ) : null}
                  </View>
                </SectionCard>

                <SectionCard title="Handover status" icon={ShieldCheck}>
                  <Text className="font-sans text-[15px] font-semibold text-foreground">
                    {statusCopy?.title}
                  </Text>
                  <Text className="font-sans mt-1 text-[13px] font-normal leading-5 text-secondary-foreground">
                    {statusCopy?.description}
                  </Text>
                  <View className="mt-3">
                    {[
                      { label: 'Documents approved', done: handover.eligibility.documentsVerified },
                      {
                        label: 'Booking confirmed',
                        done: handover.eligibility.bookingConfirmed || handover.bookingStatus === 'ongoing',
                      },
                      {
                        label: 'Outgoing inspection complete',
                        done: handover.eligibility.outgoingInspectionComplete,
                      },
                      {
                        label: 'Staff handover started',
                        done: ['in_progress', 'ready_for_release', 'released'].includes(
                          handover.setup?.status ?? '',
                        ),
                      },
                      {
                        label: 'Setup ready for release',
                        done: ['ready_for_release', 'released'].includes(handover.setup?.status ?? ''),
                      },
                      { label: 'Rental released by staff', done: handover.setup?.status === 'released' },
                    ].map((item) => (
                      <View
                        key={item.label}
                        className="flex-row items-center gap-3 border-b border-border py-3">
                        <CheckCircle2
                          size={18}
                          color={item.done ? themeColors.success : themeColors.subtleForeground}
                        />
                        <Text className="font-sans min-w-0 flex-1 text-[13px] font-medium text-foreground">
                          {item.label}
                        </Text>
                        <Text
                          className={`font-sans text-[11px] font-medium ${item.done ? 'text-success' : 'text-secondary-foreground'}`}>
                          {item.done ? 'Done' : 'Waiting'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {!handover.eligibility.documentsVerified ? (
                    <ActionButton
                      className="mt-4"
                      label="Manage documents"
                      icon={FileCheck2}
                      variant="soft"
                      onPress={() => router.push('/profile/documents' as Href)}
                    />
                  ) : null}
                  {handover.eligibility.testMode ? (
                    <Text className="font-sans mt-4 rounded-[18px] border border-warning-border bg-warning-surface p-3 text-[12px] font-medium leading-5 text-warning">
                      Local handover test mode is active. Readiness gates are relaxed; skipped requirements
                      are not marked complete.
                    </Text>
                  ) : null}
                </SectionCard>

                {feedback ? (
                  <View
                    accessibilityLiveRegion="polite"
                    className={`rounded-[24px] border p-4 ${feedback.failed ? 'border-destructive-border bg-destructive-surface' : 'border-success-border bg-success-surface'}`}>
                    <Text
                      className={`font-sans text-[13px] font-medium leading-5 ${feedback.failed ? 'text-destructive' : 'text-success'}`}>
                      {feedback.message}
                    </Text>
                  </View>
                ) : null}

                <TelematicsSetupChecklist
                  handover={handover}
                  actingStep={actingStep}
                  disabled={loading || Boolean(loadError)}
                  onCheckSetup={() => void checkSetup(confirmPhoneMount)}
                />

                <SectionCard title="Monitoring zones" icon={MapPin}>
                  <Text className="font-sans text-[13px] font-normal leading-5 text-secondary-foreground">
                    JamJade manages entry and exit information on the website. Being outside a zone does not
                    block your setup. Live trip tracking is not available yet.
                  </Text>
                </SectionCard>

                <SectionCard title="Calibration" icon={CalendarDays}>
                  <Text className="font-sans text-[13px] font-normal leading-5 text-secondary-foreground">
                    Supervised calibration is not available yet. JamJade must implement it before standard
                    handover can be released.
                  </Text>
                  <View className="mt-3 gap-2">
                    {handover.steps
                      .filter((step) => !isDeviceSetupStep(step.type))
                      .map((step) => (
                        <View key={step.type} className="rounded-[18px] bg-background p-3">
                          <Text className="font-sans text-[13px] font-medium text-foreground">
                            {step.label}
                          </Text>
                          <Text className="font-sans mt-1 text-[11px] font-medium text-secondary-foreground">
                            Unavailable
                          </Text>
                        </View>
                      ))}
                  </View>
                </SectionCard>

                <SectionCard title="Rental activity" icon={Navigation}>
                  <InfoRow
                    label="Vehicle release"
                    value={
                      handover.setup?.status === 'released' ? 'Released by JamJade' : 'Waiting for staff'
                    }
                  />
                  <InfoRow
                    label="Recorded trip"
                    value={
                      handover.tripStatus ? handover.tripStatus.replaceAll('_', ' ') : 'No trip recorded'
                    }
                  />
                  <Text className="font-sans mt-2 text-[13px] font-normal leading-5 text-secondary-foreground">
                    Active location tracking and driving-event collection are not available in the mobile app
                    yet. Your device setup does not start a trip or collect data in the background.
                  </Text>
                </SectionCard>
              </>
            )}
            <ActionButton
              label="View all bookings"
              icon={ClipboardList}
              onPress={() => router.navigate('/(tabs)/bookings')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
