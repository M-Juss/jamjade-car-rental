import { floatingTabBarContentPadding } from '@/constants/layout';
import { Redirect, useRouter, type Href } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoutConfirmationDialog } from '@/components/auth/LogoutConfirmationDialog';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAuth } from '@/providers/AuthProvider';
import { themeColors } from '@/constants/theme';

export default function DriverLogoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, status } = useAuth();
  const [isLogoutDialogVisible, setIsLogoutDialogVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (status === 'guest') return <Redirect href="/login" />;

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: insets.bottom + floatingTabBarContentPadding, paddingTop: insets.top + 12 }}>
          <CustomerTabHeader title="Logout" />

          <View className="mt-2 rounded-card border border-border bg-surface p-card ">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-destructive-surface">
              <LogOut color={themeColors.destructive} size={27} strokeWidth={2.4} />
            </View>
            <Text className="font-sans mt-5 text-[22px] font-semibold text-foreground">
              Ready to log out?
            </Text>
            <Text className="font-sans mt-2 text-[13px] font-normal leading-5 text-secondary-foreground">
              You will be signed out on this device. You can sign in again whenever you are ready.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isLoggingOut}
              onPress={() => setIsLogoutDialogVisible(true)}
              className="mt-6 min-h-control flex-row items-center justify-center gap-2 rounded-full bg-destructive">
              {isLoggingOut ? (
                <ActivityIndicator color={themeColors.surface} />
              ) : (
                <LogOut color={themeColors.surface} size={17} strokeWidth={2.5} />
              )}
              <Text className="font-sans text-[14px] font-semibold text-surface">Logout</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <LogoutConfirmationDialog
        accountLabel="driver"
        isLoading={isLoggingOut}
        onCancel={() => setIsLogoutDialogVisible(false)}
        onConfirm={async () => {
          if (isLoggingOut) {
            return;
          }

          setIsLoggingOut(true);

          try {
            await signOut();
            setIsLogoutDialogVisible(false);
            router.replace('/login' as Href);
          } finally {
            setIsLoggingOut(false);
          }
        }}
        visible={isLogoutDialogVisible}
      />
    </View>
  );
}
