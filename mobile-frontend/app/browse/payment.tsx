import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingStepper, ErrorState, SelectedVehicleSummary, browseIcons } from '@/components/browse';
import { decodeBookingData } from '@/lib/browse/booking-params';
import { formatPeso, getVehicleById } from '@/lib/browse/pricing';

type PaymentSelection = 'down_payment' | 'full_payment';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function PaymentChoiceCard({
  amount,
  description,
  isSelected,
  onPress,
  title,
}: {
  title: string;
  description: string;
  amount: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={cx(
        'rounded-[26px] border p-5',
        isSelected ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
      )}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="text-[17px] font-black text-[#17315F]">{title}</Text>
          <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]">{description}</Text>
        </View>
        <View className={cx('h-8 w-8 items-center justify-center rounded-full border', isSelected ? 'border-[#346EF6] bg-[#346EF6]' : 'border-[#C8D4E8] bg-white')}>
          {isSelected && <browseIcons.Check size={17} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </View>
      <Text className="mt-4 text-[24px] font-black text-[#346EF6]">{amount}</Text>
    </Pressable>
  );
}

export default function PaymentScreen() {
  const router = useRouter();
  const { booking: bookingParam } = useLocalSearchParams<{ booking?: string }>();
  const booking = decodeBookingData(bookingParam);
  const vehicle = getVehicleById(booking?.vehicleId);
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>('down_payment');

  if (!booking || !vehicle) {
    return <ErrorState onAction={() => router.replace('/')} title="Payment unavailable" subtitle="Start again from an available vehicle." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8 pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-full bg-white">
              <browseIcons.Car size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-[27px] font-black text-[#17315F]">Payment</Text>
              <Text className="mt-1 text-[13px] font-semibold text-[#6C7A96]">Choose your payment amount</Text>
            </View>
          </View>

          <View className="mt-5">
            <BookingStepper step={3} />
          </View>

          <View className="mt-6">
            <SelectedVehicleSummary vehicle={vehicle} />
          </View>

          <View className="mt-6 gap-3">
            <PaymentChoiceCard
              title="Down Payment"
              description="Pay 30% of the full cost first."
              amount={formatPeso(booking.downPaymentAmount)}
              isSelected={paymentSelection === 'down_payment'}
              onPress={() => setPaymentSelection('down_payment')}
            />
            <PaymentChoiceCard
              title="Full Payment"
              description="Pay the full booking cost."
              amount={formatPeso(booking.totalAmount)}
              isSelected={paymentSelection === 'full_payment'}
              onPress={() => setPaymentSelection('full_payment')}
            />
          </View>

          <View className="mt-6 min-h-[220px] rounded-[30px] border border-dashed border-[#C8D4E8] bg-white" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
