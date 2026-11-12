import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { RefreshCcw, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BookingCard, BookingLoadingState, type BookingAction } from '@/components/bookings';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { matchesBookingSearch } from '@/lib/bookings/helpers';
import { getDriverServices } from '@/services/api';
import type { Booking } from '@/types/booking';

type ServiceFilter = 'Upcoming' | 'Active' | 'History';
const filters: ServiceFilter[] = ['Upcoming', 'Active', 'History'];

export function DriverServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [services, setServices] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<ServiceFilter>('Upcoming');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (tab !== 'history') return;
    setFilter('History');
    setSearch('');
    router.setParams({ tab: '' });
  }, [router, tab]));
  useFocusEffect(useCallback(() => {
    let current = true;
    let reading = false;
    const load = async () => {
      if (reading) return;
      reading = true;
      try { const records = await getDriverServices(); if (current) { setServices(records); setError(null); } }
      catch { if (current) setError('Services could not be refreshed. Try again.'); }
      finally { reading = false; if (current) setLoading(false); }
    };
    void load();
    const interval = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 15000);
    return () => { current = false; clearInterval(interval); };
  }, []));
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { setServices(await getDriverServices()); setError(null); }
    catch { setError('Services could not be refreshed. Try again.'); }
    finally { setRefreshing(false); }
  };
  const visible = useMemo(() => services.filter(booking => {
    const matchesStatus = filter === 'Active' ? ['Active', 'Ongoing'].includes(booking.status)
      : filter === 'History' ? ['Returned', 'Completed', 'Cancelled', 'Rejected'].includes(booking.status)
        : ['Pending', 'Confirmed'].includes(booking.status);
    return matchesStatus && matchesBookingSearch(booking, search);
  }), [services, filter, search]);
  const details = (booking: Booking) => router.push(`/driver-services/${encodeURIComponent(booking.id)}` as Href);
  const action = (selected: BookingAction, booking: Booking) => {
    if (selected.key === 'open_telematics') router.push(`/driver-telematics/${encodeURIComponent(booking.id)}` as Href);
    else if (selected.key === 'pay_balance') router.push(`/driver-payment?bookingId=${encodeURIComponent(booking.id)}` as Href);
  };
  return <View className="flex-1 bg-background">
    <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[themeColors.primary]} />}>
      <View className="w-full max-w-[560px] self-center px-screen" style={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + floatingTabBarContentPadding }}>
        <View className="flex-row items-center gap-3">
          <CustomerTabHeader title="Services" className="flex-1" />
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh services" disabled={refreshing || loading} onPress={() => void refresh()} className="h-11 w-11 items-center justify-center disabled:opacity-50"><RefreshCcw size={20} color={themeColors.primary} strokeWidth={2} /></Pressable>
        </View>
        <View className="mt-3 min-h-control flex-row items-center rounded-field border border-border bg-surface px-4">
          <Search size={20} color={themeColors.subtleForeground} strokeWidth={2} />
          <TextInput accessibilityLabel="Search services" value={search} onChangeText={setSearch} placeholder="Search booking ID or vehicle" placeholderTextColor={themeColors.subtleForeground} className="font-sans min-w-0 flex-1 px-3 text-body text-foreground" />
        </View>
        <View accessibilityRole="tablist" className="mt-3 flex-row gap-2">
          {filters.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} className={`min-h-control min-w-0 flex-1 items-center justify-center rounded-field border px-2 py-2 ${filter === item ? 'border-primary bg-primary' : 'border-border bg-surface'}`}><Text className={`font-sans text-caption font-medium ${filter === item ? 'text-surface' : 'text-foreground'}`}>{item}</Text></Pressable>)}
        </View>
        <View className="mt-section gap-3">
          {error ? <View className="gap-2 rounded-card border border-destructive-border bg-destructive-surface p-card"><Text accessibilityRole="alert" className="font-sans text-body text-destructive">{error}</Text><ActionButton density="compact" label="Try again" disabled={refreshing} onPress={() => void refresh()} /></View> : null}
          {loading ? <BookingLoadingState /> : <>
            {visible.map(booking => <BookingCard key={booking.id} booking={booking} audience="driver" onViewDetails={details} onAction={action} />)}
            {!error && visible.length === 0 ? <View className="rounded-card border border-border bg-surface p-card"><Text className="font-sans text-center text-body text-secondary-foreground">{search.trim() ? 'No matching services.' : `No ${filter.toLowerCase()} services.`}</Text></View> : null}
          </>}
        </View>
      </View>
    </ScrollView>
  </View>;
}
