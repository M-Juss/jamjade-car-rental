import { themeColors } from '@/constants/theme';
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
        <BottomActionButton label="Browse Vehicles" onPress={() => router.replace('/(tabs)' as Href)} />
      }>
      <View className="py-8">
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-success-surface">
            <CheckCircle2 size={54} color={themeColors.success} strokeWidth={2.4} />
          </View>
          <Text className="font-sans mt-5 text-center text-title font-semibold text-foreground">
            {firstName ? `Welcome, ${firstName}!` : 'Welcome to Jamjade!'}
          </Text>
          <Text className="font-sans mt-3 text-center text-[15px] font-normal leading-6 text-secondary-foreground">
            Your account and customer profile are ready. You can now browse available vehicles and start
            booking.
          </Text>
        </View>

        <View className="mt-6 gap-3 rounded-card border border-border bg-surface p-5 ">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CarFront size={20} color={themeColors.primary} strokeWidth={2.45} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[14px] font-semibold text-foreground">Browse vehicles</Text>
              <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">
                View vehicle details, prices, features, and availability.
              </Text>
            </View>
          </View>

          <View className="h-px bg-border" />

          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CalendarCheck2 size={20} color={themeColors.primary} strokeWidth={2.45} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[14px] font-semibold text-foreground">Book when ready</Text>
              <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">
                Owner-driver booking is available while self-drive documents are under review.
              </Text>
            </View>
          </View>

          <View className="h-px bg-border" />

          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <ShieldCheck size={20} color={themeColors.primary} strokeWidth={2.45} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[14px] font-semibold text-foreground">
                Verify documents anytime
              </Text>
              <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">
                Open Profile to submit or review the documents required for self-drive booking.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </OnboardingScreenFrame>
  );
}
