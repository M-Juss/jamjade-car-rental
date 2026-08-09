import { useRouter, type Href } from 'expo-router';
import { CalendarCheck2, CarFront, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { useCustomer } from '@/lib/customer/customer-store';

export default function AccountReadyScreen() {
  const router = useRouter();
  const customer = useCustomer();
  const firstName = customer.firstName.trim();

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Browse Vehicles"
          onPress={() => router.replace('/(tabs)' as Href)}
        />
      }>
      <View className="min-h-[620px] justify-center">
        <View className="items-center">
          <View className="h-[106px] w-[106px] items-center justify-center rounded-full bg-success-surface">
            <CheckCircle2 size={54} color="#047857" strokeWidth={2.4} />
          </View>
          <Text className="mt-8 text-center text-[31px] font-black leading-[36px] text-foreground">
            {firstName ? `Welcome, ${firstName}!` : 'Welcome to Jamjade!'}
          </Text>
          <Text className="mt-3 text-center text-[15px] font-semibold leading-6 text-muted-foreground">
            Your account and customer profile are ready. You can now browse available vehicles and start booking.
          </Text>
        </View>

        <View className="mt-9 gap-3 rounded-[28px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CarFront size={20} color="#346EF6" strokeWidth={2.45} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-black text-foreground">Browse vehicles</Text>
              <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
                View vehicle details, prices, features, and availability.
              </Text>
            </View>
          </View>

          <View className="h-px bg-[#EEF2FF]" />

          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CalendarCheck2 size={20} color="#346EF6" strokeWidth={2.45} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-black text-foreground">Book when ready</Text>
              <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
                Owner-driver booking is available while self-drive documents are under review.
              </Text>
            </View>
          </View>

          <View className="h-px bg-[#EEF2FF]" />

          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <ShieldCheck size={20} color="#346EF6" strokeWidth={2.45} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-black text-foreground">Verify documents anytime</Text>
              <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
                Open Profile to submit or review the documents required for self-drive booking.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </OnboardingScreenFrame>
  );
}
