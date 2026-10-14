import { themeColors } from '@/constants/theme';
import { LogoutHeaderButton } from '@/components/auth/LogoutHeaderButton';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BookingStepper,
  ErrorState,
  PriceBreakdownCard,
  SelectedVehicleSummary,
  browseIcons,
} from '@/components/browse';
import {
  DateWithLabel,
  getNextDateKey,
  getPreviousDateKey,
  TimePickerWithLabel,
} from '@/components/common';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { bookingFormSchema, type BookingValidationInput } from '@/validation';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import { DeliveryRequestsPanel } from '@/components/browse/DeliveryRequestsPanel';
import { getDeliveryQuote } from '@/services/api/delivery.service';
import { DeliveryRouteForm } from '@/forms/booking/DeliveryRouteForm';
import { quoteMatches, type DeliveryQuote } from '@/services/api/delivery.service';
import { startBookingFlow } from '@/lib/browse/booking-flow';
import { SHOP_LOCATION, JAMJADE_GARAGE } from '@/lib/browse/rental-config';
import { isFuturePickupTime } from '@/lib/browse/pickup-time';
import {
  OWNER_DRIVER_METRO_MANILA_DAILY_RATE,
  OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE,
  formatPeso,
  getNumberOfDays,
  getPriceBreakdown,
} from '@/lib/browse/pricing';
import {
  getBookingAvailability,
  getSelfDriveBookingAvailability,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { BookingFormData, VehicleUnavailableDateRange } from '@/types/browse';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function overlapsUnavailableDates(
  startDate: string,
  endDate: string,
  unavailableDateRanges: VehicleUnavailableDateRange[],
) {
  return unavailableDateRanges.some((range) => startDate <= range.endDate && endDate >= range.startDate);
}

function getMaximumReturnDate(rentalDate: string, unavailableDateRanges: VehicleUnavailableDateRange[]) {
  if (!rentalDate) {
    return undefined;
  }

  const nextUnavailableDate = unavailableDateRanges
    .map((range) => range.startDate)
    .filter((startDate) => startDate > rentalDate)
    .sort()[0];

  return nextUnavailableDate ? getPreviousDateKey(nextUnavailableDate) : undefined;
}

function Section({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="font-sans mb-3 text-[18px] font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function SelectableCard({
  description,
  disabled = false,
  icon: Icon,
  infoText,
  isSelected,
  onPress,
  title,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  isSelected: boolean;
  onPress: () => void;
  disabled?: boolean;
  infoText?: string;
}) {
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({
    arrowLeft: 24,
    placement: 'below' as 'above' | 'below',
    left: 16,
    top: 16,
    width: 260,
  });
  const infoAnchorRef = useRef<View>(null);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const showInfo = () => {
    infoAnchorRef.current?.measureInWindow((x, y, width, height) => {
      const tooltipWidth = Math.min(280, screenWidth - 32);
      const estimatedHeight = 132;
      const anchorCenter = x + width / 2;
      const left = Math.min(Math.max(16, anchorCenter - tooltipWidth + 34), screenWidth - tooltipWidth - 16);
      const shouldPlaceAbove = y + height + estimatedHeight + 24 > screenHeight;
      const top = shouldPlaceAbove ? Math.max(16, y - estimatedHeight - 12) : y + height + 12;

      setTooltipPosition({
        arrowLeft: Math.min(Math.max(18, anchorCenter - left - 7), tooltipWidth - 32),
        placement: shouldPlaceAbove ? 'above' : 'below',
        left,
        top,
        width: tooltipWidth,
      });
      setIsInfoVisible(true);
    });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isSelected }}
        onPress={() => {
          if (!disabled) {
            onPress();
          }
        }}
        className={cx(
          'min-h-[76px] rounded-card border p-3',
          isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
          disabled && 'opacity-60',
        )}>
        <View className="flex-row items-center gap-3">
          <View
            className={cx(
              'h-10 w-10 items-center justify-center rounded-full',
              isSelected ? 'bg-primary' : 'bg-muted',
            )}>
            <Icon size={20} color={isSelected ? themeColors.surface : themeColors.primary} strokeWidth={2} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[15px] font-semibold text-foreground">{title}</Text>
            <Text className="font-sans mt-1 text-caption text-secondary-foreground">{description}</Text>
          </View>
          {infoText ? (
            <View ref={infoAnchorRef} collapsable={false}>
              <Pressable
                accessibilityLabel={`${title} information`}
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  showInfo();
                }}
                className="h-11 w-11 items-center justify-center rounded-full bg-surface">
                <browseIcons.Info size={18} color={themeColors.primary} />
              </Pressable>
            </View>
          ) : null}
          {isSelected && <browseIcons.Check size={18} color={themeColors.primary} />}
        </View>
      </Pressable>

      {infoText ? (
        <Modal
          animationType="fade"
          transparent
          visible={isInfoVisible}
          onRequestClose={() => setIsInfoVisible(false)}>
          <Pressable className="flex-1 bg-foreground/20" onPress={() => setIsInfoVisible(false)}>
            <Pressable
              accessibilityRole="alert"
              onPress={(event) => event.stopPropagation()}
              style={{
                backgroundColor: themeColors.foreground,
                borderColor: themeColors.primary,
                borderWidth: 1,
                left: tooltipPosition.left,
                position: 'absolute',
                top: tooltipPosition.top,
                width: tooltipPosition.width,
              }}
              className="rounded-[18px] px-5 py-4 shadow-black/30">
              <View
                style={{
                  backgroundColor: themeColors.foreground,
                  left: tooltipPosition.arrowLeft,
                  position: 'absolute',
                  [tooltipPosition.placement === 'below' ? 'top' : 'bottom']: -7,
                  transform: [{ rotate: '45deg' }],
                }}
                className="h-4 w-4"
              />
              <Text className="font-sans text-[14px] font-semibold leading-6 text-surface">{infoText}</Text>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

export function BookingForm() {
  const router = useRouter();
  const { vehicleId, deliveryQuoteId } = useLocalSearchParams<{ vehicleId?: string; deliveryQuoteId?: string }>();
  const resolvedVehicleId = firstParam(vehicleId);
  const { vehicle, isLoading, error, reload } = useVehicle(resolvedVehicleId);
  const customer = useCustomer();
  const bookingAvailability = useMemo(() => getBookingAvailability(customer), [customer]);
  const selfDriveAvailability = useMemo(() => getSelfDriveBookingAvailability(customer), [customer]);
  const toast = useFormToast();
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    setError,
    setValue,
    watch,
  } = useForm<BookingValidationInput>({
    defaultValues: {
      canSelfDrive: selfDriveAvailability.canSelfDrive,
      deliveryTime: '',
      driverOption: selfDriveAvailability.canSelfDrive ? 'self_drive' : 'owners_driver',
      numberOfDays: 0,
      ownerDriverCoverage: 'metro_manila',
      pickupLocation: '',
      pickupOption: 'shop',
      rentalDate: '',
      returnDate: '',
      selfDriveMessage: selfDriveAvailability.message,
    },
    resolver: zodResolver(bookingFormSchema),
  });
  const rentalDate = watch('rentalDate');
  const returnDate = watch('returnDate');
  const pickupLocation = watch('pickupLocation');
  const deliveryTime = watch('deliveryTime');
  const driverOption = watch('driverOption');
  const [isGaragePickup, setIsGaragePickup] = useState(true);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const pickupOption: BookingFormData['pickupOption'] = driverOption === 'self_drive' || isGaragePickup ? 'shop' : 'delivery';
  const ownerDriverCoverage = watch('ownerDriverCoverage');
  const resumeQuote = (q: DeliveryQuote) => {
    if (q.status === 'consumed' && q.bookingId) {
      router.replace(`/bookings/${encodeURIComponent(q.bookingId)}` as Href);
      return;
    }
    setValue('rentalDate', q.rentalStartAt.slice(0,10));
    setValue('returnDate', q.rentalEndAt.slice(0,10));
    setValue('deliveryTime', q.rentalStartAt.slice(11,16));
    setValue('driverOption', 'owners_driver');
    setValue('ownerDriverCoverage', q.ownerDriverCoverage);
    setValue('pickupLocation', q.destinationAddress);
    setIsGaragePickup(false);
    setDeliveryQuote(q);
    clearErrors();
  };
  const resumeRef = useRef(resumeQuote);
  resumeRef.current = resumeQuote;
  useEffect(() => {
    const id = firstParam(deliveryQuoteId);
    if (!id) return;
    let active = true;
    getDeliveryQuote(id).then(q => { if(active && q.vehicleId === resolvedVehicleId) resumeRef.current(q); }).catch(() => { if(active) toast.showToast('This delivery request could not be resumed. Refresh your saved requests.'); });
    return () => {active = false;};
  }, [deliveryQuoteId, resolvedVehicleId, toast.showToast]);
  const numberOfDays = useMemo(() => getNumberOfDays(rentalDate, returnDate), [rentalDate, returnDate]);

  useEffect(() => {
    setValue('canSelfDrive', selfDriveAvailability.canSelfDrive);
    setValue('selfDriveMessage', selfDriveAvailability.message);

    if (!selfDriveAvailability.canSelfDrive && driverOption === 'self_drive') {
      setValue('driverOption', 'owners_driver');
      setValue('pickupOption', 'shop');
      setValue('pickupLocation', '');
      setValue('deliveryTime', '');
      setIsGaragePickup(true);
      clearErrors(['deliveryTime', 'driverOption', 'pickupLocation']);
    }
  }, [
    clearErrors,
    driverOption,
    selfDriveAvailability.canSelfDrive,
    selfDriveAvailability.message,
    setValue,
  ]);

  useEffect(() => {
    setValue('numberOfDays', numberOfDays);
    setValue('pickupOption', pickupOption);
  }, [numberOfDays, pickupOption, setValue]);

  const minimumReturnDate = rentalDate ? getNextDateKey(rentalDate) : undefined;
  const maximumReturnDate = useMemo(
    () => getMaximumReturnDate(rentalDate, vehicle?.unavailableDateRanges ?? []),
    [rentalDate, vehicle?.unavailableDateRanges],
  );
  const breakdown = useMemo(() => {
    if (!vehicle) {
      return null;
    }

    return getPriceBreakdown(
      vehicle,
      numberOfDays,
      driverOption,
      pickupOption,
      ownerDriverCoverage,
      pickupLocation,
      deliveryQuote && pickupOption === 'delivery' && quoteMatches(deliveryQuote, vehicle.id, `${rentalDate} ${deliveryTime}`, `${returnDate} ${deliveryTime}`, ownerDriverCoverage, pickupLocation) && deliveryQuote.status === 'ready' && Date.parse(deliveryQuote.expiresAt ?? '') > Date.now() ? deliveryQuote : undefined,
    );
  }, [deliveryQuote, rentalDate, returnDate, deliveryTime, driverOption, numberOfDays, ownerDriverCoverage, pickupLocation, pickupOption, vehicle]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  if (!bookingAvailability.canBook) {
    const isBalanceBlocked = bookingAvailability.reason === 'balance';

    return (
      <ErrorState
        actionLabel={
          isBalanceBlocked
            ? 'View My Bookings'
            : bookingAvailability.reason === 'profile'
              ? 'Complete Profile'
              : 'Back to Browse'
        }
        subtitle={bookingAvailability.message}
        title={isBalanceBlocked ? 'Booking locked' : undefined}
        onAction={() =>
          router.replace(
            isBalanceBlocked
              ? ('/(tabs)/bookings' as Href)
              : bookingAvailability.reason === 'profile'
                ? '/onboarding/basic-info'
                : '/onboarding/age-restriction',
          )
        }
      />
    );
  }

  if (!vehicle || !breakdown) {
    return (
      <ErrorState
        actionLabel={error ? 'Try Again' : 'Back to Browse'}
        subtitle={error ?? 'The selected vehicle could not be loaded for booking.'}
        onAction={() => (error ? void reload() : router.replace('/'))}
      />
    );
  }

  const handleRentalDateChange = (nextRentalDate: string) => {
    setValue('rentalDate', nextRentalDate, { shouldDirty: true });
    clearErrors(['rentalDate', 'returnDate']);

    if (
      returnDate &&
      (Date.parse(returnDate) <= Date.parse(nextRentalDate) ||
        overlapsUnavailableDates(nextRentalDate, returnDate, vehicle?.unavailableDateRanges ?? []))
    ) {
      setValue('returnDate', '', { shouldDirty: true });
    }

    if (deliveryTime && !isFuturePickupTime(nextRentalDate, deliveryTime)) {
      setValue('deliveryTime', '', { shouldDirty: true });
      clearErrors('deliveryTime');
    }
  };

  const handleReturnDateChange = (nextReturnDate: string) => {
    setValue('returnDate', nextReturnDate, { shouldDirty: true });
    clearErrors('returnDate');
  };

  const handlePickupLocationChange = (nextPickupLocation: string) => {
    setValue('pickupLocation', nextPickupLocation, { shouldDirty: true });
    clearErrors('pickupLocation');
  };

  const handleDeliveryTimeChange = (value: string) => {
    setValue('deliveryTime', value, { shouldDirty: true });
    clearErrors('deliveryTime');
  };

  const handleGaragePickupChange = () => {
    setIsGaragePickup(true);
    setValue('pickupLocation', JAMJADE_GARAGE, { shouldDirty: true });
    clearErrors('pickupLocation');
  };

  const handleCustomPickupChange = () => {
    setIsGaragePickup(false);
    setValue('pickupLocation', '', { shouldDirty: true });
    clearErrors('pickupLocation');
  };

  const handleDriverOptionChange = (nextDriverOption: BookingFormData['driverOption']) => {
    setValue('driverOption', nextDriverOption, { shouldDirty: true });
    setValue('pickupOption', 'shop');
    setValue('pickupLocation', '');
    setValue('deliveryTime', '');
    setIsGaragePickup(true);
    clearErrors(['deliveryTime', 'driverOption', 'pickupLocation']);
  };

  const onSubmit = (values: BookingValidationInput) => {
    if (
      overlapsUnavailableDates(values.rentalDate, values.returnDate, vehicle?.unavailableDateRanges ?? [])
    ) {
      setError('returnDate', {
        message: 'These dates overlap a confirmed booking for this vehicle.',
        type: 'validate',
      });
      toast.showToast('Selected dates are not available.');
      return;
    }

    const pickupTime = values.deliveryTime ? ` ${values.deliveryTime}` : '';
    if (values.pickupOption === 'delivery' && (!deliveryQuote || deliveryQuote.status !== 'ready' || Date.parse(deliveryQuote.expiresAt ?? '') <= Date.now() || !quoteMatches(deliveryQuote, vehicle.id, `${values.rentalDate}${pickupTime}`, `${values.returnDate}${pickupTime}`, values.ownerDriverCoverage, values.pickupLocation))) {
      setError('pickupLocation', { message: 'Choose a complete, valid delivery quote before continuing.' });
      toast.showToast('Delivery needs a complete, valid quote before checkout.');
      return;
    }

    const booking: BookingFormData = {
      deliveryQuoteId: values.pickupOption === 'delivery' ? deliveryQuote?.id : undefined,
      deliveryQuoteExpiresAt: values.pickupOption === 'delivery' ? deliveryQuote?.expiresAt ?? undefined : undefined,
      priceBreakdown: breakdown,
      vehicleId: vehicle.id,
      rentalDate: values.rentalDate,
      returnDate: values.returnDate,
      rentalStartAt: `${values.rentalDate}${pickupTime}`,
      rentalEndAt: `${values.returnDate}${pickupTime}`,
      numberOfDays: values.numberOfDays,
      pickupOption: values.pickupOption,
      pickupLocation: values.pickupOption === 'shop' ? JAMJADE_GARAGE : values.pickupLocation.trim(),
      deliveryTime: values.deliveryTime,
      returnLocation: values.pickupOption === 'shop' ? JAMJADE_GARAGE : values.pickupLocation.trim(),
      driverOption: values.driverOption,
      ownerDriverCoverage: values.driverOption === 'owners_driver' ? values.ownerDriverCoverage : undefined,
      totalAmount: breakdown.totalAmount,
      downPaymentAmount: breakdown.downPaymentAmount,
      remainingBalance: breakdown.remainingBalance,
    };
    const flowId = startBookingFlow(booking);

    router.push(
      `/browse/checkout?flow=${encodeURIComponent(flowId)}&vehicleId=${encodeURIComponent(vehicle.id)}` as Href,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="px-5 pb-6 pt-2">
              <View className="flex-row items-center gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.back()}
                  className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                  <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.45} />
                </Pressable>
                <View className="min-w-0 flex-1">
                  <Text className="font-sans text-title font-semibold text-foreground">Booking Details</Text>
                  <Text className="font-sans mt-1 text-[13px] font-normal text-secondary-foreground">
                    Complete your rental request
                  </Text>
                </View>
                <LogoutHeaderButton />
              </View>

              <View className="mt-5">
                <BookingStepper step={1} />
              </View>

              <View className="mt-5">
                <SelectedVehicleSummary vehicle={vehicle} />
              </View>

              <DeliveryRequestsPanel vehicleId={vehicle.id} onResume={resumeQuote} />

              <Section title="Rental Schedule">
                <View className="gap-4 rounded-card border border-border bg-surface p-4">
                  <DateWithLabel
                    disabledDateRanges={vehicle.unavailableDateRanges}
                    error={errors.rentalDate?.message}
                    label="Rental date"
                    value={rentalDate}
                    onChange={handleRentalDateChange}
                    placeholder="Select rental date"
                  />
                  <DateWithLabel
                    disabledDateRanges={vehicle.unavailableDateRanges}
                    error={errors.returnDate?.message}
                    helperText={rentalDate ? 'Confirmed booking dates are unavailable.' : undefined}
                    label="Return date"
                    maximumDate={maximumReturnDate}
                    minimumDate={minimumReturnDate}
                    value={returnDate}
                    onChange={handleReturnDateChange}
                    placeholder="Select return date"
                  />
                  <View className="rounded-2xl bg-muted p-4">
                    <Text className="font-sans text-[12px] font-normal text-secondary-foreground">
                      Number of days
                    </Text>
                    <Text className="font-sans mt-1 text-[22px] font-semibold text-foreground">
                      {numberOfDays} day{numberOfDays > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </Section>

              <Section title="Driver Option">
                <View className="gap-2">
                  <SelectableCard
                    icon={browseIcons.Car}
                    title="Self-drive"
                    description="Drive the vehicle yourself."
                    infoText={
                      selfDriveAvailability.canSelfDrive
                        ? "Self-drive requires approved identity, driver's license, and address documents before booking."
                        : selfDriveAvailability.message
                    }
                    isSelected={driverOption === 'self_drive'}
                    disabled={!selfDriveAvailability.canSelfDrive}
                    onPress={() => handleDriverOptionChange('self_drive')}
                  />
                  <SelectableCard
                    icon={browseIcons.UserRound}
                    title="Owner's Driver"
                    description="Request Jamjade driver support."
                    isSelected={driverOption === 'owners_driver'}
                    onPress={() => handleDriverOptionChange('owners_driver')}
                  />
                </View>
                {errors.driverOption ? (
                  <View className="mt-3 rounded-[24px] border border-[#FFCACA] bg-[#FFF5F5] p-4">
                    <Text className="font-sans text-[13px] font-medium leading-5 text-destructive">
                      {errors.driverOption.message}
                    </Text>
                  </View>
                ) : null}
              </Section>

              <Section title={driverOption === 'self_drive' ? 'Pickup Details' : 'Delivery & Trip Details'}>
                {driverOption === 'self_drive' ? (
                  <View className="rounded-card border border-border bg-surface p-4">
                    <View className="flex-row items-center gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <browseIcons.MapPin size={21} color={themeColors.primary} strokeWidth={2.35} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans text-[12px] font-normal text-secondary-foreground">
                          Shop pickup required
                        </Text>
                        <Text className="font-sans mt-1 text-[15px] font-semibold text-foreground">
                          {SHOP_LOCATION}
                        </Text>
                      </View>
                    </View>
                    <Text className="font-sans mt-3 text-caption text-secondary-foreground">
                      Self-drive vehicles must be collected from the shop for final verification and release.
                    </Text>
                  </View>
                ) : isGaragePickup ? (
                  <Text className="font-sans text-[13px] font-normal leading-6 text-secondary-foreground">
                    Pickup and return at the Jamjade Garage are free.
                  </Text>
                ) : (
                  <Text className="font-sans text-[13px] font-normal leading-6 text-secondary-foreground">
                    Delivery is priced from the selected driving route. Any toll charge needs staff approval.
                  </Text>
                )}

                {driverOption === 'owners_driver' ? (
                  <View className="mt-4">
                    <View className="gap-2">
                      <SelectableCard
                        icon={browseIcons.Car}
                        title="Jamjade Garage"
                        description="Free pickup — no delivery fee."
                        isSelected={isGaragePickup}
                        onPress={handleGaragePickupChange}
                      />
                      <SelectableCard
                        icon={browseIcons.MapPin}
                        title="Custom location"
                        description="Choose a route and receive a delivery quote."
                        isSelected={!isGaragePickup}
                        onPress={handleCustomPickupChange}
                      />
                    </View>

                    {isGaragePickup ? (
                      <View className="mt-4 rounded-[24px] border border-border bg-surface p-4">
                        <Text className="font-sans text-[12px] font-normal text-secondary-foreground">
                          Delivery location
                        </Text>
                        <Text className="font-sans mt-1 text-[15px] font-semibold text-foreground">
                          {JAMJADE_GARAGE}
                        </Text>
                        <Text className="font-sans mt-2 text-caption text-secondary-foreground">
                          The vehicle is released from and returned to the Jamjade Garage.
                        </Text>
                      </View>
                    ) : (
                      <View className="mt-4">
                        <DeliveryRouteForm
                          key={`${vehicle.id}-${rentalDate}-${returnDate}-${deliveryTime}-${ownerDriverCoverage}`}
                          initialQuote={deliveryQuote && quoteMatches(deliveryQuote, vehicle.id, `${rentalDate} ${deliveryTime}`, `${returnDate} ${deliveryTime}`, ownerDriverCoverage, pickupLocation) ? deliveryQuote : undefined}
                          vehicleId={vehicle.id} start={`${rentalDate} ${deliveryTime}`} end={`${returnDate} ${deliveryTime}`} coverage={ownerDriverCoverage}
                          address={pickupLocation} onAddress={handlePickupLocationChange} onQuote={setDeliveryQuote}
                        />
                        {errors.pickupLocation && <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{errors.pickupLocation.message}</Text>}
                      </View>
                    )}
                  </View>
                ) : null}

                <TimePickerWithLabel
                  required
                  error={errors.deliveryTime?.message}
                  helperText="The vehicle is picked up and returned at this time."
                  label="Pickup time"
                  placeholder="Select pickup time"
                  value={deliveryTime}
                  onChange={handleDeliveryTimeChange}
                  pickupDate={rentalDate}
                  wrapperClassName="mt-4"
                />
              </Section>

              {driverOption === 'owners_driver' && (
                <Section title="Trip Coverage">
                  <View className="gap-2">
                    <SelectableCard
                      icon={browseIcons.MapPin}
                      title="Within Metro Manila"
                      description={`${formatPeso(OWNER_DRIVER_METRO_MANILA_DAILY_RATE)} fixed per day.`}
                      isSelected={ownerDriverCoverage === 'metro_manila'}
                      onPress={() => {
                        setValue('ownerDriverCoverage', 'metro_manila', {
                          shouldDirty: true,
                        });
                      }}
                    />
                    <SelectableCard
                      icon={browseIcons.Navigation}
                      title="Outside Manila"
                      description={`${formatPeso(OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE)} fixed per day.`}
                      isSelected={ownerDriverCoverage === 'outside_manila'}
                      onPress={() => {
                        setValue('ownerDriverCoverage', 'outside_manila', {
                          shouldDirty: true,
                        });
                      }}
                    />
                  </View>
                </Section>
              )}

              <Section title="Price Breakdown">
                {pickupOption === 'delivery' && (!deliveryQuote || deliveryQuote.status !== 'ready') ? <Text className="font-sans text-body text-secondary-foreground">Choose a delivery route and wait for any required toll approval to see the complete price.</Text> : <PriceBreakdownCard breakdown={breakdown} />}
              </Section>

              <Pressable
                accessibilityRole="button"
                onPress={handleSubmit(onSubmit, () => {
                  toast.showToast('Check the highlighted booking details.');
                })}
                className="mt-6 min-h-control items-center justify-center rounded-full bg-primary ">
                <Text className="font-sans text-[16px] font-semibold text-surface">Review Booking</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <FormToast
          message={toast.message}
          onDismiss={toast.clearToast}
          title={toast.title}
          variant={toast.variant}
        />
      </View>
    </SafeAreaView>
  );
}
