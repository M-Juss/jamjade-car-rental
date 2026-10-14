import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { Bell, CreditCard } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { getNotifications, markNotificationAsRead, type MobileNotificationRecord } from '@/services/api';

export default function DriverNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<MobileNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void getNotifications()
        .then(setNotifications)
        .finally(() => setIsLoading(false));
    }, []),
  );

  const open = async (notification: MobileNotificationRecord) => {
    if (!notification.isRead) await markNotificationAsRead(notification.id).catch(() => undefined);
    if (notification.data?.action === 'pay_outstanding' && notification.bookingId) {
      router.push(`/driver-payment?bookingId=${encodeURIComponent(notification.bookingId)}` as Href);
      return;
    }
    router.push('/(driver)/services');
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="never">
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: insets.bottom + floatingTabBarContentPadding, paddingTop: insets.top + 12 }}>
          <CustomerTabHeader title="Notifications" />
          {isLoading ? <ActivityIndicator className="mt-2" color={themeColors.primary} /> : null}
          <View className="mt-2 gap-3">
            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                onPress={() => void open(notification)}
                className={`rounded-[24px] border p-4 ${notification.isRead ? 'border-border bg-surface' : 'border-primary bg-muted'}`}>
                <View className="flex-row items-start gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                    {notification.data?.action === 'pay_outstanding' ? (
                      <CreditCard color={themeColors.primary} size={19} />
                    ) : (
                      <Bell color={themeColors.primary} size={19} />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans text-[14px] font-semibold text-foreground">
                      {notification.title}
                    </Text>
                    <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">
                      {notification.message}
                    </Text>
                    {notification.actionLabel ? (
                      <Text className="font-sans mt-2 text-[11px] font-semibold text-primary">
                        {notification.actionLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
            {!isLoading && notifications.length === 0 ? (
              <Text className="font-sans py-10 text-center text-[13px] font-medium text-secondary-foreground">
                No notifications yet.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
