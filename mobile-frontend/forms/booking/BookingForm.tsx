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
  LocationSearchWithLabel,
  TimePickerWithLabel,
} from '@/components/common';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import {
  bookingFormSchema,
  type BookingValidationInput,
} from '@/validation';
import { useVehicle } from '@/hooks/use-vehicles';
import { firstParam } from '@/lib/browse/booking-params';
import { startBookingFlow } from '@/lib/browse/booking-flow';
import { SHOP_LOCATION } from '@/lib/browse/rental-config';
import {
  DELIVERY_FEE,
  OWNER_DRIVER_METRO_MANILA_DAILY_RATE,
  OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE,
  formatPeso,
  getNumberOfDays,
  getPriceBreakdown,
} from '@/lib/browse/pricing';
import {
  getBookingAgeAvailability,
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
  return unavailableDateRanges.some(
    (range) => startDate <= range.endDate && endDate >= range.startDate,
  );
}

function getMaximumReturnDate(
  rentalDate: string,
  unavailableDateRanges: VehicleUnavailableDateRange[],
) {
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
    <View className="mt-6">
      <Text className="mb-3 text-[18px] font-black text-foreground">{title}</Text>
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
      const left = Math.min(
        Math.max(16, anchorCenter - tooltipWidth + 34),
        screenWidth - tooltipWidth - 16,
      );
      const shouldPlaceAbove = y + height + estimatedHeight + 24 > screenHeight;
      const top = shouldPlaceAbove
        ? Math.max(16, y - estimatedHeight - 12)
        : y + height + 12;

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
          'flex-1 rounded-[24px] border p-4',
          isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
          disabled && 'opacity-60',
        )}>
        <View className="flex-row items-start justify-between gap-3">
          <View className={cx('h-11 w-11 items-center justify-center rounded-full', isSelected ? 'bg-primary' : 'bg-muted')}>
            <Icon size={21} color={isSelected ? '#FFFFFF' : '#346EF6'} strokeWidth={2.35} />
          </View>
          <View className="flex-row items-center gap-2">
            {infoText ? (
              <View ref={infoAnchorRef} collapsable={false}>
                <Pressable
                  accessibilityLabel={`${title} information`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={(event) => {
                    event.stopPropagation();
                    showInfo();
                  }}
                  className="h-8 w-8 items-center justify-center rounded-full bg-surface">
                  <browseIcons.Info size={17} color="#346EF6" strokeWidth={2.5} />
                </Pressable>
              </View>
            ) : null}
            {isSelected && <browseIcons.Check size={20} color="#346EF6" strokeWidth={2.7} />}
          </View>
        </View>
        <Text className="mt-4 text-[15px] font-black text-foreground">{title}</Text>
        <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">{description}</Text>
      </Pressable>

      {infoText ? (
        <Modal
          animationType="fade"
          transparent
          visible={isInfoVisible}
          onRequestClose={() => setIsInfoVisible(false)}>
          <Pressable className="flex-1 bg-[#0B1220]/20" onPress={() => setIsInfoVisible(false)}>
            <Pressable
              accessibilityRole="alert"
              onPress={(event) => event.stopPropagation()}
              style={{
                backgroundColor: '#17315F',
                borderColor: '#346EF6',
                borderWidth: 1,
                left: tooltipPosition.left,
                position: 'absolute',
                top: tooltipPosition.top,
                width: tooltipPosition.width,
              }}
              className="rounded-[18px] px-5 py-4 shadow-xl shadow-black/30">
              <View
                style={{
                  backgroundColor: '#17315F',
                  left: tooltipPosition.arrowLeft,
                  position: 'absolute',
                  [tooltipPosition.placement === 'below' ? 'top' : 'bottom']: -7,
                  transform: [{ rotate: '45deg' }],
                }}
                className="h-4 w-4"
              />
              <Text className="text-[14px] font-semibold leading-6 text-surface">
                {infoText}
              </Text>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

export function BookingForm() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const resolvedVehicleId = firstParam(vehicleId);
  const { vehicle, isLoading, error, reload } = useVehicle(resolvedVehicleId);
  const customer = useCustomer();
  const bookingAgeAvailability = useMemo(
    () => getBookingAgeAvailability(customer),
    [customer],
  );
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
      pickupOption: selfDriveAvailability.canSelfDrive ? 'shop' : 'delivery',
      rentalDate: '',
      returnDate: '',
      returnLocation: '',
      selfDriveMessage: selfDriveAvailability.message,
    },
    resolver: zodResolver(bookingFormSchema),
  });
  const rentalDate = watch('rentalDate');
  const returnDate = watch('returnDate');
  const pickupLocation = watch('pickupLocation');
  const deliveryTime = watch('deliveryTime');
  const driverOption = watch('driverOption');
  const pickupOption: BookingFormData['pickupOption'] =
    driverOption === 'self_drive' ? 'shop' : 'delivery';
  const returnLocation = watch('returnLocation');
  const [isReturnLocationSameAsPickup, setIsReturnLocationSameAsPickup] = useState(false);
  const ownerDriverCoverage = watch('ownerDriverCoverage');
  const numberOfDays = useMemo(
    () => getNumberOfDays(rentalDate, returnDate),
    [rentalDate, returnDate],
  );

  useEffect(() => {
    setValue('canSelfDrive', selfDriveAvailability.canSelfDrive);
    setValue('selfDriveMessage', selfDriveAvailability.message);

    if (!selfDriveAvailability.canSelfDrive && driverOption === 'self_drive') {
      setValue('driverOption', 'owners_driver');
      setValue('pickupOption', 'delivery');
      setValue('pickupLocation', '');
      setValue('deliveryTime', '');
      setValue('returnLocation', '');
      setIsReturnLocationSameAsPickup(false);
      clearErrors(['deliveryTime', 'driverOption', 'pickupLocation', 'returnLocation']);
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
    );
  }, [driverOption, numberOfDays, ownerDriverCoverage, pickupOption, vehicle]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  if (!bookingAgeAvailability.canBook) {
    return (
      <ErrorState
        actionLabel={
          bookingAgeAvailability.reason === 'profile'
            ? 'Complete Profile'
            : 'Back to Browse'
        }
        subtitle={bookingAgeAvailability.message}
        onAction={() => router.replace(
          bookingAgeAvailability.reason === 'profile'
            ? '/onboarding/basic-info'
            : '/onboarding/age-restriction',
        )}
      />
    );
  }

  if (!vehicle || !breakdown) {
    return (
      <ErrorState
        actionLabel={error ? 'Try Again' : 'Back to Browse'}
        subtitle={error ?? 'The selected vehicle could not be loaded for booking.'}
        onAction={() => error ? void reload() : router.replace('/')}
      />
    );
  }

  const handleRentalDateChange = (nextRentalDate: string) => {
    setValue('rentalDate', nextRentalDate, { shouldDirty: true });
    clearErrors(['rentalDate', 'returnDate']);

    if (
      returnDate &&
      (
        Date.parse(returnDate) <= Date.parse(nextRentalDate) ||
        overlapsUnavailableDates(
          nextRentalDate,
          returnDate,
          vehicle?.unavailableDateRanges ?? [],
        )
      )
    ) {
      setValue('returnDate', '', { shouldDirty: true });
    }
  };

  const handleReturnDateChange = (nextReturnDate: string) => {
    setValue('returnDate', nextReturnDate, { shouldDirty: true });
    clearErrors('returnDate');
  };

  const handlePickupLocationChange = (nextPickupLocation: string) => {
    setValue('pickupLocation', nextPickupLocation, { shouldDirty: true });

    if (isReturnLocationSameAsPickup) {
      if (nextPickupLocation.trim()) {
        setValue('returnLocation', nextPickupLocation, { shouldDirty: true });
      } else {
        setIsReturnLocationSameAsPickup(false);
        setValue('returnLocation', '', { shouldDirty: true });
      }
    }

    clearErrors(['pickupLocation', 'returnLocation']);
  };

  const handleDeliveryTimeChange = (value: string) => {
    setValue('deliveryTime', value, { shouldDirty: true });
    clearErrors('deliveryTime');
  };

  const handleDriverOptionChange = (nextDriverOption: BookingFormData['driverOption']) => {
    setValue('driverOption', nextDriverOption, { shouldDirty: true });
    setValue('pickupOption', nextDriverOption === 'self_drive' ? 'shop' : 'delivery');
    setValue('pickupLocation', '');
    setValue('deliveryTime', '');
    setValue('returnLocation', '');
    setIsReturnLocationSameAsPickup(false);
    clearErrors(['deliveryTime', 'driverOption', 'pickupLocation', 'returnLocation']);
  };

  const handleReturnLocationChange = (nextReturnLocation: string) => {
    setValue('returnLocation', nextReturnLocation, { shouldDirty: true });
    clearErrors('returnLocation');
  };

  const handleSameAsPickupChange = () => {
    if (!pickupLocation.trim()) {
      return;
    }

    const nextValue = !isReturnLocationSameAsPickup;

    setIsReturnLocationSameAsPickup(nextValue);
    setValue('returnLocation', nextValue ? pickupLocation : '', {
      shouldDirty: true,
    });
    clearErrors('returnLocation');
  };

  const onSubmit = (values: BookingValidationInput) => {
    if (
      overlapsUnavailableDates(
        values.rentalDate,
        values.returnDate,
        vehicle?.unavailableDateRanges ?? [],
      )
    ) {
      setError('returnDate', {
        message: 'These dates overlap an approved booking for this vehicle.',
        type: 'validate',
      });
      toast.showToast('Selected dates are not available.');
      return;
    }

    const booking: BookingFormData = {
      vehicleId: vehicle.id,
      rentalDate: values.rentalDate,
      returnDate: values.returnDate,
      numberOfDays: values.numberOfDays,
      pickupOption: values.pickupOption,
      pickupLocation:
        values.pickupOption === 'shop' ? SHOP_LOCATION : values.pickupLocation.trim(),
      deliveryTime:
        values.pickupOption === 'delivery' ? values.deliveryTime : undefined,
      returnLocation:
        values.pickupOption === 'shop' ? SHOP_LOCATION : values.returnLocation.trim(),
      driverOption: values.driverOption,
      ownerDriverCoverage:
        values.driverOption === 'owners_driver'
          ? values.ownerDriverCoverage
          : undefined,
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
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View className="px-5 pb-6 pt-2">
              <View className="flex-row items-center gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.back()}
                  className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                  <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
                </Pressable>
                <View className="min-w-0 flex-1">
                  <Text className="text-[27px] font-black text-foreground">Booking Details</Text>
                  <Text className="mt-1 text-[13px] font-semibold text-muted-foreground">Complete your rental request</Text>
                </View>
              </View>

              <View className="mt-5">
                <BookingStepper step={1} />
              </View>

              <View className="mt-6">
                <SelectedVehicleSummary vehicle={vehicle} />
              </View>

              <Section title="Rental Schedule">
                <View className="gap-4 rounded-[28px] border border-border bg-surface p-4">
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
                    helperText={rentalDate ? 'Approved booking dates are unavailable.' : undefined}
                    label="Return date"
                    maximumDate={maximumReturnDate}
                    minimumDate={minimumReturnDate}
                    value={returnDate}
                    onChange={handleReturnDateChange}
                    placeholder="Select return date"
                  />
                  <View className="rounded-2xl bg-muted p-4">
                    <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-subtle-foreground">Number of days</Text>
                    <Text className="mt-1 text-[22px] font-black text-foreground">{numberOfDays} day{numberOfDays > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </Section>

              <Section title="Driver Option">
                <View className="flex-row gap-3">
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
                    <Text className="text-[13px] font-bold leading-5 text-[#B42318]">
                      {errors.driverOption.message}
                    </Text>
                  </View>
                ) : null}
              </Section>

              <Section title={driverOption === 'self_drive' ? 'Pickup Details' : 'Delivery & Trip Details'}>
                {driverOption === 'self_drive' ? (
                  <View className="rounded-[28px] border border-border bg-surface p-4">
                    <View className="flex-row items-center gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <browseIcons.MapPin size={21} color="#346EF6" strokeWidth={2.35} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-subtle-foreground">
                          Shop pickup required
                        </Text>
                        <Text className="mt-1 text-[15px] font-black text-foreground">
                          {SHOP_LOCATION}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-3 text-[12px] font-semibold leading-5 text-muted-foreground">
                      Self-drive vehicles must be collected from the shop for final verification and release.
                    </Text>
                  </View>
                ) : (
                  <Text className="text-[13px] font-semibold leading-6 text-muted-foreground">
                    Delivery is required for owner&apos;s driver bookings. A {formatPeso(DELIVERY_FEE)} delivery fee will be added to the booking total.
                  </Text>
                )}

                {driverOption === 'owners_driver' ? (
                  <View className="mt-4">
                    <LocationSearchWithLabel
                      error={errors.pickupLocation?.message}
                      helperText="Start typing and choose a Google Maps suggestion, or enter the address manually."
                      label="Delivery location"
                      value={pickupLocation}
                      onChangeText={handlePickupLocationChange}
                      placeholder="Where should we deliver the vehicle?"
                    />
                    <TimePickerWithLabel
                      required
                      error={errors.deliveryTime?.message}
                      helperText="Choose the requested delivery time."
                      label="Delivery time"
                      placeholder="Select delivery time"
                      value={deliveryTime}
                      onChange={handleDeliveryTimeChange}
                      wrapperClassName="mt-4"
                    />

                    <View className="mt-4">
                      <LocationSearchWithLabel
                        disabled={isReturnLocationSameAsPickup}
                        error={errors.returnLocation?.message}
                        helperText="Choose where the owner's driver should end the trip."
                        label="Specific end trip location"
                        value={returnLocation}
                        onChangeText={handleReturnLocationChange}
                        placeholder="Search for a specific end trip location"
                      />
                    </View>

                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: isReturnLocationSameAsPickup,
                        disabled: !pickupLocation.trim(),
                      }}
                      disabled={!pickupLocation.trim()}
                      onPress={handleSameAsPickupChange}
                      className={cx(
                        'flex-row items-center gap-3 rounded-[22px] border border-border bg-surface p-4',
                        !pickupLocation.trim() && 'opacity-50',
                      )}>
                      <View
                        className={cx(
                          'h-7 w-7 items-center justify-center rounded-lg border',
                          isReturnLocationSameAsPickup
                            ? 'border-primary bg-primary'
                            : 'border-[#C8D4E8] bg-surface',
                        )}>
                        {isReturnLocationSameAsPickup ? (
                          <browseIcons.Check size={17} color="#FFFFFF" strokeWidth={3} />
                        ) : null}
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-[14px] font-black text-foreground">
                          Same as pickup address
                        </Text>
                        <Text className="mt-1 text-[12px] font-semibold text-muted-foreground">
                          {pickupLocation.trim()
                            ? 'End the trip at the delivery location.'
                            : 'Enter a delivery location to enable this option.'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </Section>

              {driverOption === 'owners_driver' && (
                <Section title="Trip Coverage">
                  <View className="flex-row gap-3">
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
                <PriceBreakdownCard breakdown={breakdown} />
              </Section>

              <Pressable
                accessibilityRole="button"
                onPress={handleSubmit(onSubmit, () => {
                  toast.showToast('Check the highlighted booking details.');
                })}
                className="mt-8 min-h-[60px] items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25">
                <Text className="text-[16px] font-black text-surface">Review Booking</Text>
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
