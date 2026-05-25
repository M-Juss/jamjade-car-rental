import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BookingStepper,
  ErrorState,
  OptionalServiceCard,
  RequiredDocumentsCard,
  SelectedVehicleSummary,
  browseIcons,
  optionalServices,
} from '@/components/browse';
import { encodeBookingData, firstParam } from '@/lib/browse/booking-params';
import { SHOP_LOCATION } from '@/lib/browse/mock-data';
import { formatPeso, getNumberOfDays, getPriceBreakdown, getVehicleById } from '@/lib/browse/pricing';
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

function FieldInput({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-[#91A0B8]">{label}</Text>
      <View className="min-h-[54px] flex-row items-center rounded-2xl border border-[#E6EEFF] bg-white px-4">
        <browseIcons.CalendarDays size={18} color="#346EF6" strokeWidth={2.35} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AA4B8"
          className="min-w-0 flex-1 px-3 text-[15px] font-bold text-[#17315F]"
        />
      </View>
    </View>
  );
}

function SelectableCard({
  description,
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
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={cx(
        'flex-1 rounded-[24px] border p-4',
        isSelected ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
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
  const vehicle = getVehicleById(firstParam(vehicleId));
  const [rentalDate, setRentalDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [pickupOption, setPickupOption] = useState<BookingFormData['pickupOption']>('shop');
  const [pickupLocation, setPickupLocation] = useState('');
  const [driverOption, setDriverOption] = useState<BookingFormData['driverOption']>('self_drive');
  const [requiredDocumentsAcknowledged, setRequiredDocumentsAcknowledged] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [paymentOption, setPaymentOption] = useState<BookingFormData['paymentOption']>('down_payment');
  const [errors, setErrors] = useState<string[]>([]);

  const numberOfDays = useMemo(() => getNumberOfDays(rentalDate, returnDate), [rentalDate, returnDate]);
  const breakdown = useMemo(() => {
    if (!vehicle) {
      return null;
    }

    return getPriceBreakdown(vehicle, numberOfDays, selectedServices, paymentOption);
  }, [numberOfDays, paymentOption, selectedServices, vehicle]);

  if (!vehicle || !breakdown) {
    return <ErrorState onAction={() => router.replace('/')} />;
  }

  const toggleService = (serviceId: string) => {
    setSelectedServices((current) =>
      current.includes(serviceId) ? current.filter((item) => item !== serviceId) : [...current, serviceId],
    );
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

    if (driverOption === 'self_drive' && !requiredDocumentsAcknowledged) {
      nextErrors.push('Self-drive documents must be acknowledged.');
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
      requiredDocumentsAcknowledged,
      optionalServices: selectedServices,
      paymentOption,
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
                <FieldInput label="Rental date" value={rentalDate} onChangeText={setRentalDate} placeholder="2026-06-01" />
                <FieldInput label="Return date" value={returnDate} onChangeText={setReturnDate} placeholder="2026-06-03" />
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
                <View className="mt-3 min-h-[56px] flex-row items-center rounded-[24px] border border-[#E6EEFF] bg-white px-4">
                  <browseIcons.MapPinned size={18} color="#346EF6" strokeWidth={2.35} />
                  <TextInput
                    value={pickupLocation}
                    onChangeText={setPickupLocation}
                    placeholder="Preferred pickup location"
                    placeholderTextColor="#9AA4B8"
                    className="min-w-0 flex-1 px-3 text-[15px] font-bold text-[#17315F]"
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
            </Section>

            <Section title="Required Documents">
              <RequiredDocumentsCard
                driverOption={driverOption}
                acknowledged={requiredDocumentsAcknowledged}
                onToggleAcknowledged={() => setRequiredDocumentsAcknowledged((value) => !value)}
              />
            </Section>

            <Section title="Optional Services">
              <View className="gap-3">
                {optionalServices.map((service) => (
                  <OptionalServiceCard
                    key={service.id}
                    service={service}
                    isSelected={selectedServices.includes(service.id)}
                    onToggle={() => toggleService(service.id)}
                  />
                ))}
              </View>
            </Section>

            <Section title="Payment Option">
              <View className="flex-row gap-3">
                <SelectableCard
                  icon={browseIcons.CreditCard}
                  title="Down Payment"
                  description="Pay 30% now, settle remaining balance later."
                  isSelected={paymentOption === 'down_payment'}
                  onPress={() => setPaymentOption('down_payment')}
                />
                <SelectableCard
                  icon={browseIcons.CircleCheck}
                  title="Full Payment"
                  description="Pay the total booking amount."
                  isSelected={paymentOption === 'full_payment'}
                  onPress={() => setPaymentOption('full_payment')}
                />
              </View>
              {paymentOption === 'down_payment' && (
                <View className="mt-3 rounded-[24px] border border-[#FFE7A6] bg-[#FFF9E8] p-4">
                  <Text className="text-[13px] font-bold leading-5 text-[#806128]">
                    Remaining balance must be paid 1 day before the rental date.
                  </Text>
                </View>
              )}
              <View className="mt-3 rounded-[24px] border border-[#DDE8FF] bg-white p-4">
                <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">Estimated total</Text>
                <Text className="mt-1 text-[25px] font-black text-[#17315F]">{formatPeso(breakdown.totalAmount)}</Text>
                <Text className="mt-1 text-[12px] font-semibold text-[#6C7A96]">Toll fee is paid based on consumption.</Text>
              </View>
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
