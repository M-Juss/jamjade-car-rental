import { useRouter, type Href } from 'expo-router';
import { CircleAlert, RefreshCcw } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, BookingEmptyState, SectionCard } from '@/components/bookings';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { TelematicsRentalCard } from '@/components/telematics/TelematicsRentalCard';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { useTelematicsRentals } from '@/hooks/telematics/useTelematicsRentals';

export function TelematicsRentalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rentals, loading, refreshing, loadingMore, error, pageError, hasMore, verified, refresh, loadMore } = useTelematicsRentals();
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={() => void refresh()} tintColor={themeColors.primary} colors={[themeColors.primary]} />}>
        <View className="w-full max-w-[560px] flex-grow self-center px-screen" style={{ paddingTop: insets.top + 10, paddingBottom: floatingTabBarContentPadding + insets.bottom }}>
          <View className="flex-row items-center gap-3">
            <CustomerTabHeader title="Telematics" className="min-w-0 flex-1" showLogout={false} />
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh rentals" accessibilityState={{ disabled: refreshing || loading || loadingMore }} disabled={refreshing || loading || loadingMore} onPress={() => void refresh()} className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50">
              <RefreshCcw size={20} color={themeColors.primary} />
            </Pressable>
          </View>
          <View className="flex-grow justify-center gap-4 py-5">
            {loading ? <View className="items-center rounded-card border border-border bg-surface p-8">
              <ActivityIndicator color={themeColors.primary} />
              <Text className="font-sans mt-3 text-body text-secondary-foreground">Loading rentals…</Text>
            </View> : <>
              {error ? <SectionCard title="Rentals unavailable" icon={CircleAlert}>
                <Text accessibilityLiveRegion="polite" className="font-sans mb-4 text-body leading-6 text-secondary-foreground">{error}</Text>
                <ActionButton label="Try again" variant="primary" disabled={refreshing} onPress={() => void refresh()} />
              </SectionCard> : null}
              {!error && rentals.length === 0 ? <BookingEmptyState title="No self-drive rental" subtitle="Your self-drive handover and setup will appear here." buttonLabel="View bookings" onBrowsePress={() => router.navigate('/(tabs)/bookings')} /> : null}
              {rentals.map((rental) => <TelematicsRentalCard
                key={rental.bookingCode}
                rental={rental}
                unavailable={!verified}
                onOpen={() => { if (verified) router.push(`/telematics/${encodeURIComponent(rental.bookingCode)}` as Href); }}
                onDetails={() => router.push(`/bookings/${encodeURIComponent(rental.bookingCode)}` as Href)}
                onDocuments={() => router.push('/profile/documents' as Href)}
              />)}
              {pageError ? <Text accessibilityLiveRegion="polite" className="font-sans text-body text-destructive">{pageError}</Text> : null}
              {hasMore ? <ActionButton label={loadingMore ? 'Loading rentals…' : pageError ? 'Retry loading more' : 'Load more rentals'} disabled={loadingMore || refreshing || !verified} onPress={() => void loadMore()} /> : null}
            </>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
