import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingStepper, ErrorState, browseIcons } from '@/components/browse';
import { decodeBookingData, firstParam } from '@/lib/browse/booking-params';
import { formatPeso, getVehicleById } from '@/lib/browse/pricing';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text className="min-w-0 flex-1 text-[13px] font-bold text-[#6C7A96]">{label}</Text>
      <Text className="max-w-[58%] text-right text-[13px] font-black text-[#17315F]">{value}</Text>
    </View>
  );
}

export default function BookingSuccessScreen() {
  const router = useRouter();
  const { booking: bookingParam, reference } = useLocalSearchParams<{ booking?: string; reference?: string }>();
  const booking = decodeBookingData(bookingParam);
  const vehicle = getVehicleById(booking?.vehicleId);
  const bookingReference = firstParam(reference) ?? 'JJ-000000';

  if (!booking || !vehicle) {
    return <ErrorState onAction={() => router.replace('/')} title="Confirmation unavailable" subtitle="The mock booking confirmation could not be loaded." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-6 pt-2">
          <BookingStepper step={3} />

          <View className="mt-8 items-center rounded-[34px] border border-[#DDE8FF] bg-white px-5 py-8 shadow-xl shadow-[#17315F]/8">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-[#EAFBF2]">
              <browseIcons.CircleCheck size={42} color="#159947" strokeWidth={2.5} />
            </View>
            <Text className="mt-5 text-center text-[29px] font-black text-[#17315F]">Booking Submitted</Text>
            <Text className="mt-3 text-center text-[14px] font-semibold leading-6 text-[#6C7A96]">
              Your booking request has been submitted and is now pending admin approval.
            </Text>

            <View className="mt-6 w-full rounded-[26px] bg-[#F8FAFF] p-5">
              <DetailRow label="Booking reference" value={bookingReference} />
              <DetailRow label="Vehicle" value={vehicle.name} />
              <DetailRow label="Rental date" value={booking.rentalDate} />
              <DetailRow label="Return date" value={booking.returnDate} />
              <DetailRow label="Total amount" value={formatPeso(booking.totalAmount)} />
              <DetailRow label="Payment status" value="Pending verification" />
              <DetailRow label="Booking status" value="Pending" />
            </View>
          </View>

          <View className="mt-7 gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/history')}
              className="min-h-[60px] items-center justify-center rounded-full bg-[#346EF6] shadow-lg shadow-[#346EF6]/25">
              <Text className="text-[16px] font-black text-white">View My Bookings</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              className="min-h-[56px] items-center justify-center rounded-full border border-[#DDE8FF] bg-white">
              <Text className="text-[15px] font-black text-[#17315F]">Back to Browse</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
