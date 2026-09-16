import { useRouter, type Href } from 'expo-router';
import { ArrowLeft, LogIn } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const defaultFilters: BrowseFilters = {
  features: [],
  sort: 'featured',
};

function matchesSearch(vehicle: Vehicle, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    vehicle.name,
    vehicle.brand,
    vehicle.model,
    vehicle.color,
    vehicle.transmission,
    vehicle.fuelType,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function matchesFilters(vehicle: Vehicle, filters: BrowseFilters, bookmarkedVehicleIds: string[]) {
  const matchesPrice = !filters.maxPrice || vehicle.pricePerDay <= filters.maxPrice;
  const matchesTransmission = !filters.transmission || vehicle.transmission === filters.transmission;
  const matchesFuelType = !filters.fuelType || vehicle.fuelType === filters.fuelType;
  const matchesSeats = !filters.seats || vehicle.seats === filters.seats;
  const matchesFeatures = filters.features.every((feature) => vehicle.features.includes(feature));
  const matchesFeatured = !filters.featuredOnly || Boolean(vehicle.isFeatured);
  const matchesBookmarked = !filters.bookmarkedOnly || bookmarkedVehicleIds.includes(vehicle.id);

  return (
    matchesPrice &&
    matchesTransmission &&
    matchesFuelType &&
    matchesSeats &&
    matchesFeatures &&
    matchesFeatured &&
    matchesBookmarked
  );
}

function sortVehicles(vehicles: Vehicle[], sort: SortOption) {
  return [...vehicles].sort((first, second) => {
    if (sort === 'lowest_price') {
      return first.pricePerDay - second.pricePerDay;
    }

    if (sort === 'highest_price') {
      return second.pricePerDay - first.pricePerDay;
    }

    if (sort === 'featured') {
      return Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured));
    }

    return Date.parse(second.createdAt) - Date.parse(first.createdAt);
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
          <ArrowLeft size={21} color="#17315F" strokeWidth={2.5} />
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-black uppercase tracking-[0.8px] text-primary">
            Guest browsing
          </Text>
          <Text className="mt-0.5 text-[12px] font-semibold text-muted-foreground" numberOfLines={1}>
            Explore before creating an account
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Sign in to JamJade"
          accessibilityRole="button"
          onPress={() => router.push('/login' as Href)}
          className="min-h-12 flex-row items-center gap-2 rounded-full bg-primary px-4">
          <LogIn size={17} color="#FFFFFF" strokeWidth={2.6} />
          <Text className="text-[13px] font-black text-surface">Sign In</Text>
        </Pressable>
      </View>

    </>
  );
}

export function VehicleCatalogScreen({ mode, onScroll }: VehicleCatalogScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<BrowseFilters>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();
  const {
    vehicles: availableVehicles,
    isLoading,
    error,
    refresh,
  } = useAvailableVehicles();

  const vehicles = useMemo(() => {
    const filteredVehicles = availableVehicles.filter(
      (vehicle) => matchesSearch(vehicle, searchTerm) && matchesFilters(vehicle, filters, bookmarkedVehicleIds),
    );

    return sortVehicles(filteredVehicles, filters.sort ?? 'featured');
  }, [availableVehicles, bookmarkedVehicleIds, filters, searchTerm]);

  const activeFilterCount =
    Number(Boolean(filters.bookmarkedOnly)) +
    Number(Boolean(filters.maxPrice)) +
    Number(Boolean(filters.featuredOnly)) +
    Number(Boolean(filters.transmission)) +
    Number(Boolean(filters.fuelType)) +
    Number(Boolean(filters.seats)) +
    Number((filters.sort ?? 'featured') !== 'featured') +
    filters.features.length;
  const bottomPadding = mode === 'customer' ? 112 + insets.bottom : 32 + insets.bottom;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        refreshControl={(
          <RefreshControl
            colors={['#346EF6']}
            refreshing={isLoading && availableVehicles.length > 0}
            tintColor="#346EF6"
            onRefresh={() => void refresh()}
          />
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: bottomPadding, paddingTop: insets.top + 10 }}>
          {mode === 'guest' ? (
            <GuestCatalogHeader />
          ) : (
            <CustomerTabHeader description="Choose the right car for your next trip." />
          )}

          <View className="mt-6">
            <SearchInput
              activeFilterCount={activeFilterCount}
              value={searchTerm}
              onSearchChange={setSearchTerm}
              onFilterPress={() => setIsFilterOpen(true)}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-between">
            <Text className="text-[13px] font-black text-foreground">
              {vehicles.length} available vehicles
            </Text>
            <Text className="text-[12px] font-bold text-subtle-foreground">Live fleet</Text>
          </View>

          <View className="mt-4 gap-6">
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
