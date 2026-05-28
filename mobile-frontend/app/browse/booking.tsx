import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BookingStepper,
  ErrorState,
  PriceBreakdownCard,
  SelectedVehicleSummary,
  browseIcons,
} from '@/components/browse';
import { DateWithLabel, getNextDateKey, LocationSearchWithLabel } from '@/components/common';
import { encodeBookingData, firstParam } from '@/lib/browse/booking-params';
import { SHOP_LOCATION } from '@/lib/browse/mock-data';
import {
  OWNER_DRIVER_METRO_MANILA_DAILY_RATE,
  OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE,
  formatPeso,
  getNumberOfDays,
  getPriceBreakdown,
  getVehicleById,
} from '@/lib/browse/pricing';
import { getSelfDriveBookingAvailability, useCustomer } from '@/lib/customer/customer-store';
import type { BookingFormData } from '@/types/browse';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function Section({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-3 text-[18px] font-black text-[#17315F]">{title}</Text>
      {children}
    </View>
  );
}

function SelectableCard({
  description,
  disabled = false,
  icon: Icon,
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
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'flex-1 rounded-[24px] border p-4',
        isSelected ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
        disabled && 'opacity-60',
      )}>
      <View className="flex-row items-start justify-between gap-3">
        <View className={cx('h-11 w-11 items-center justify-center rounded-full', isSelected ? 'bg-[#346EF6]' : 'bg-[#F3F7FF]')}>
          <Icon size={21} color={isSelected ? '#FFFFFF' : '#346EF6'} strokeWidth={2.35} />
        </View>
        {isSelected && <browseIcons.Check size={20} color="#346EF6" strokeWidth={2.7} />}
      </View>
      <Text className="mt-4 text-[15px] font-black text-[#17315F]">{title}</Text>
      <Text className="mt-1 text-[12px] font-semibold leading-5 text-[#6C7A96]">{description}</Text>
    </Pressable>
  );
}

export default function BookingFormScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const customer = useCustomer();
  const selfDriveAvailability = useMemo(() => getSelfDriveBookingAvailability(customer), [customer]);
  const vehicle = getVehicleById(firstParam(vehicleId));
  const [rentalDate, setRentalDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [pickupOption, setPickupOption] = useState<BookingFormData['pickupOption']>('shop');
  const [pickupLocation, setPickupLocation] = useState('');
  const [driverOption, setDriverOption] = useState<BookingFormData['driverOption']>(
    selfDriveAvailability.canSelfDrive ? 'self_drive' : 'owners_driver',
  );
  const [ownerDriverCoverage, setOwnerDriverCoverage] =
    useState<BookingFormData['ownerDriverCoverage']>('metro_manila');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!selfDriveAvailability.canSelfDrive && driverOption === 'self_drive') {
      setDriverOption('owners_driver');
    }
  }, [driverOption, selfDriveAvailability.canSelfDrive]);

  const numberOfDays = useMemo(() => getNumberOfDays(rentalDate, returnDate), [rentalDate, returnDate]);
  const minimumReturnDate = rentalDate ? getNextDateKey(rentalDate) : undefined;
  const breakdown = useMemo(() => {
    if (!vehicle) {
      return null;
    }

    return getPriceBreakdown(vehicle, numberOfDays, driverOption, ownerDriverCoverage);
  }, [driverOption, numberOfDays, ownerDriverCoverage, vehicle]);

  if (!vehicle || !breakdown) {
    return <ErrorState onAction={() => router.replace('/')} />;
  }

  const handleRentalDateChange = (nextRentalDate: string) => {
    setRentalDate(nextRentalDate);

    if (returnDate && Date.parse(returnDate) <= Date.parse(nextRentalDate)) {
      setReturnDate('');
    }
  };

  const validate = () => {
    const nextErrors: string[] = [];
    const rentalTimestamp = Date.parse(rentalDate);
    const returnTimestamp = Date.parse(returnDate);

    if (!rentalDate) {
      nextErrors.push('Rental date is required.');
    }

    if (!returnDate) {
      nextErrors.push('Return date is required.');
    }

    if (rentalDate && Number.isNaN(rentalTimestamp)) {
      nextErrors.push('Rental date must use YYYY-MM-DD.');
    }

    if (returnDate && Number.isNaN(returnTimestamp)) {
      nextErrors.push('Return date must use YYYY-MM-DD.');
    }

    if (!Number.isNaN(rentalTimestamp) && !Number.isNaN(returnTimestamp) && returnTimestamp <= rentalTimestamp) {
      nextErrors.push('Return date must be after rental date.');
    }

    if (numberOfDays < 1) {
      nextErrors.push('Number of days must be at least 1.');
    }

    if (pickupOption === 'delivery' && !pickupLocation.trim()) {
      nextErrors.push('Preferred pickup location is required for delivery.');
    }

    if (driverOption === 'self_drive' && !selfDriveAvailability.canSelfDrive) {
      nextErrors.push(selfDriveAvailability.message);
    }

    setErrors(nextErrors);

    return nextErrors.length === 0;
  };

  const handleReviewBooking = () => {
    if (!validate()) {
      return;
    }

    const booking: BookingFormData = {
      vehicleId: vehicle.id,
      rentalDate,
      returnDate,
      numberOfDays,
      pickupOption,
      pickupLocation: pickupOption === 'shop' ? SHOP_LOCATION : pickupLocation.trim(),
      driverOption,
      ownerDriverCoverage: driverOption === 'owners_driver' ? ownerDriverCoverage : undefined,
      totalAmount: breakdown.totalAmount,
      downPaymentAmount: breakdown.downPaymentAmount,
      remainingBalance: breakdown.remainingBalance,
    };

    router.push(`/browse/checkout?booking=${encodeBookingData(booking)}` as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="px-5 pb-6 pt-2">
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                className="h-12 w-12 items-center justify-center rounded-full bg-white">
                <browseIcons.Car size={21} color="#17315F" strokeWidth={2.45} />
              </Pressable>
              <View className="min-w-0 flex-1">
                <Text className="text-[27px] font-black text-[#17315F]">Booking Details</Text>
                <Text className="mt-1 text-[13px] font-semibold text-[#6C7A96]">Complete your rental request</Text>
              </View>
            </View>

            <View className="mt-5">
              <BookingStepper step={1} />
            </View>

            <View className="mt-6">
              <SelectedVehicleSummary vehicle={vehicle} />
            </View>

            {errors.length > 0 && (
              <View className="mt-5 rounded-[24px] border border-[#FFCACA] bg-[#FFF5F5] p-4">
                {errors.map((error) => (
                  <View key={error} className="flex-row gap-2 py-1">
                    <browseIcons.Info size={16} color="#D92D20" strokeWidth={2.35} />
                    <Text className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-[#B42318]">{error}</Text>
                  </View>
                ))}
              </View>
            )}

            <Section title="Rental Schedule">
              <View className="gap-4 rounded-[28px] border border-[#E6EEFF] bg-white p-4">
                <DateWithLabel
                  label="Rental date"
                  value={rentalDate}
                  onChange={handleRentalDateChange}
                  placeholder="Select rental date"
                />
                <DateWithLabel
                  helperText={rentalDate ? 'Return date must be after the rental date.' : undefined}
                  label="Return date"
                  minimumDate={minimumReturnDate}
                  value={returnDate}
                  onChange={setReturnDate}
                  placeholder="Select return date"
                />
                <View className="rounded-2xl bg-[#F3F7FF] p-4">
                  <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">Number of days</Text>
                  <Text className="mt-1 text-[22px] font-black text-[#17315F]">{numberOfDays} day{numberOfDays > 1 ? 's' : ''}</Text>
                </View>
              </View>
            </Section>

            <Section title="Pickup Option">
              <View className="flex-row gap-3">
                <SelectableCard
                  icon={browseIcons.MapPin}
                  title="Shop Pickup"
                  description="Pick up from Jamjade Garage."
                  isSelected={pickupOption === 'shop'}
                  onPress={() => setPickupOption('shop')}
                />
                <SelectableCard
                  icon={browseIcons.MapPinned}
                  title="Delivery"
                  description="Use your preferred pickup point."
                  isSelected={pickupOption === 'delivery'}
                  onPress={() => setPickupOption('delivery')}
                />
              </View>
              {pickupOption === 'shop' ? (
                <View className="mt-3 rounded-[24px] border border-[#DDE8FF] bg-[#F8FAFF] p-4">
                  <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">Fixed shop location</Text>
                  <Text className="mt-1 text-[15px] font-black text-[#17315F]">{SHOP_LOCATION}</Text>
                </View>
              ) : (
                <View className="mt-3">
                  <LocationSearchWithLabel
                    helperText="Start typing and choose a Google Maps suggestion, or enter the address manually."
                    label="Pickup location"
                    value={pickupLocation}
                    onChangeText={setPickupLocation}
                    placeholder="Preferred pickup location"
                  />
                </View>
              )}
            </Section>

            <Section title="Driver Option">
              <View className="flex-row gap-3">
                <SelectableCard
                  icon={browseIcons.Car}
                  title="Self-drive"
                  description="Drive the vehicle yourself."
                  isSelected={driverOption === 'self_drive'}
                  disabled={!selfDriveAvailability.canSelfDrive}
                  onPress={() => setDriverOption('self_drive')}
                />
                <SelectableCard
                  icon={browseIcons.UserRound}
                  title="Owner's Driver"
                  description="Request Jamjade driver support."
                  isSelected={driverOption === 'owners_driver'}
                  onPress={() => setDriverOption('owners_driver')}
                />
              </View>
              {!selfDriveAvailability.canSelfDrive ? (
                <View className="mt-3 rounded-[24px] border border-[#FFE7A6] bg-[#FFF9E8] p-4">
                  <Text className="text-[13px] font-bold leading-5 text-[#806128]">
                    {selfDriveAvailability.message}
                  </Text>
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
                    onPress={() => setOwnerDriverCoverage('metro_manila')}
                  />
                  <SelectableCard
                    icon={browseIcons.Navigation}
                    title="Outside Manila"
                    description={`${formatPeso(OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE)} fixed per day.`}
                    isSelected={ownerDriverCoverage === 'outside_manila'}
                    onPress={() => setOwnerDriverCoverage('outside_manila')}
                  />
                </View>
              </Section>
            )}

            <Section title="Price Breakdown">
              <PriceBreakdownCard breakdown={breakdown} />
            </Section>

            <Pressable
              accessibilityRole="button"
              onPress={handleReviewBooking}
              className="mt-8 min-h-[60px] items-center justify-center rounded-full bg-[#346EF6] shadow-lg shadow-[#346EF6]/25">
              <Text className="text-[16px] font-black text-white">Review Booking</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
