import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft, LogIn } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  ErrorState,
  FilterSheet,
  LoadingState,
  SearchInput,
  VehicleCard,
  type BrowseFilters,
  type SortOption,
} from '@/components/browse';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAvailableVehicles } from '@/hooks/use-vehicles';
import { toggleBookmarkedVehicle, useBookmarkedVehicleIds } from '@/lib/browse/bookmarks';
import type { Vehicle } from '@/types/browse';

type CatalogMode = 'customer' | 'guest';

type VehicleCatalogScreenProps = {
  mode: CatalogMode;
};

const defaultFilters: BrowseFilters = {};

function matchesSearch(vehicle: Vehicle, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [vehicle.name, vehicle.brand, vehicle.model, vehicle.color, vehicle.transmission, vehicle.fuelType]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function matchesFilters(vehicle: Vehicle, filters: BrowseFilters, bookmarkedVehicleIds: string[]) {
  const matchesPrice =
    (filters.minPrice === undefined || vehicle.pricePerDay >= filters.minPrice) &&
    (filters.maxPrice === undefined || vehicle.pricePerDay <= filters.maxPrice);
  const matchesBrand = !filters.brand || vehicle.brand === filters.brand;
  const matchesColor = !filters.color || vehicle.color === filters.color;
  const matchesTransmission = !filters.transmission || vehicle.transmission === filters.transmission;
  const matchesFuelType = !filters.fuelType || vehicle.fuelType === filters.fuelType;
  const matchesSeats = !filters.seats || vehicle.seats === filters.seats;
  const matchesBookmarked = filters.sort !== 'saved' || bookmarkedVehicleIds.includes(vehicle.id);

  return (
    matchesPrice &&
    matchesBrand &&
    matchesColor &&
    matchesTransmission &&
    matchesFuelType &&
    matchesSeats &&
    matchesBookmarked
  );
}

function sortVehicles(vehicles: Vehicle[], sort?: SortOption) {
  return [...vehicles].sort((first, second) => {
    if (sort === 'lowest_price') {
      return first.pricePerDay - second.pricePerDay;
    }

    if (sort === 'highest_price') {
      return second.pricePerDay - first.pricePerDay;
    }

    return 0;
  });
}

function GuestCatalogHeader() {
  const router = useRouter();

  return (
    <>
      <View className=" flex-row items-center gap-3">
        <Pressable
          accessibilityLabel="Back to landing page"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.replace('/' as Href)}
          className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface">
          <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.5} />
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[11px] font-semibold text-primary">Guest browsing</Text>
          <Text
            className="font-sans mt-0.5 text-[12px] font-normal text-secondary-foreground"
            numberOfLines={1}>
            Explore before creating an account
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Sign in to JamJade"
          accessibilityRole="button"
          onPress={() => router.push('/login' as Href)}
          className="min-h-12 flex-row items-center gap-2 rounded-full bg-primary px-4">
          <LogIn size={17} color={themeColors.surface} strokeWidth={2.6} />
          <Text className="font-sans text-[13px] font-semibold text-surface">Sign In</Text>
        </Pressable>
      </View>
    </>
  );
}

export function VehicleCatalogScreen({ mode }: VehicleCatalogScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<BrowseFilters>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();
  const { vehicles: availableVehicles, isLoading, error, refresh } = useAvailableVehicles();

  const vehicles = useMemo(() => {
    const filteredVehicles = availableVehicles.filter(
      (vehicle) =>
        matchesSearch(vehicle, searchTerm) && matchesFilters(vehicle, filters, bookmarkedVehicleIds),
    );

    return sortVehicles(filteredVehicles, filters.sort);
  }, [availableVehicles, bookmarkedVehicleIds, filters, searchTerm]);

  const activeFilterCount =
    Number(filters.minPrice !== undefined || filters.maxPrice !== undefined) +
    Number(Boolean(filters.brand)) +
    Number(Boolean(filters.color)) +
    Number(Boolean(filters.transmission)) +
    Number(Boolean(filters.fuelType)) +
    Number(Boolean(filters.seats)) +
    Number(Boolean(filters.sort));
  const bottomPadding = mode === 'customer' ? floatingTabBarContentPadding + insets.bottom : 32 + insets.bottom;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            colors={[themeColors.primary]}
            refreshing={isLoading && availableVehicles.length > 0}
            tintColor={themeColors.primary}
            onRefresh={() => void refresh()}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: bottomPadding, paddingTop: insets.top + 10 }}>
          {mode === 'guest' ? <GuestCatalogHeader /> : <CustomerTabHeader title="Browse Cars" showLogout />}

          <View className="mt-2">
            <SearchInput
              activeFilterCount={activeFilterCount}
              value={searchTerm}
              onSearchChange={setSearchTerm}
              onFilterPress={() => setIsFilterOpen(true)}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-between">
            <Text className="font-sans text-[13px] font-semibold text-foreground">
              {vehicles.length} available vehicles
            </Text>
            <Text className="font-sans text-[12px] font-medium text-secondary-foreground">Live fleet</Text>
          </View>

          <View className="mt-4 gap-3">
            {isLoading && availableVehicles.length === 0 ? (
              <LoadingState />
            ) : error && availableVehicles.length === 0 ? (
              <ErrorState
                actionLabel="Try Again"
                title="Vehicles unavailable"
                subtitle={error}
                onAction={() => void refresh()}
              />
            ) : vehicles.length > 0 ? (
              vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  isBookmarked={bookmarkedVehicleIds.includes(vehicle.id)}
                  vehicle={vehicle}
                  onBookmarkPress={() => toggleBookmarkedVehicle(vehicle.id)}
                  onPress={() => router.push(`/browse/${vehicle.id}` as Href)}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </View>
        </View>
      </ScrollView>

      <FilterSheet
        bookmarkedVehicleIds={bookmarkedVehicleIds}
        visible={isFilterOpen}
        filters={filters}
        vehicles={availableVehicles}
        onApply={setFilters}
        onClose={() => setIsFilterOpen(false)}
      />
    </View>
  );
}
