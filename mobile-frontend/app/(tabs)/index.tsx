import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  FilterSheet,
  LoadingState,
  SearchInput,
  VehicleCard,
  type BrowseFilters,
  type SortOption,
} from '@/components/browse';
import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { toggleBookmarkedVehicle, useBookmarkedVehicleIds } from '@/lib/browse/bookmarks';
import { availableVehicles } from '@/lib/browse/mock-data';
import type { Vehicle } from '@/types/browse';

const defaultFilters: BrowseFilters = {
  features: [],
  sort: 'most_booked',
};

function matchesSearch(vehicle: Vehicle, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [vehicle.name, vehicle.brand, vehicle.model, vehicle.year.toString(), vehicle.location]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function matchesFilters(vehicle: Vehicle, filters: BrowseFilters, bookmarkedVehicleIds: string[]) {
  const matchesBrand = !filters.brand || vehicle.brand === filters.brand;
  const matchesPrice = !filters.maxPrice || vehicle.pricePerDay <= filters.maxPrice;
  const matchesTransmission = !filters.transmission || vehicle.transmission === filters.transmission;
  const matchesFuelType = !filters.fuelType || vehicle.fuelType === filters.fuelType;
  const matchesSeats = !filters.seats || vehicle.seats === filters.seats;
  const matchesFeatures = filters.features.every((feature) => vehicle.features.includes(feature));
  const matchesMostBooked = !filters.mostBookedOnly || Boolean(vehicle.isMostBooked);
  const matchesBookmarked = !filters.bookmarkedOnly || bookmarkedVehicleIds.includes(vehicle.id);

  return (
    matchesBrand &&
    matchesPrice &&
    matchesTransmission &&
    matchesFuelType &&
    matchesSeats &&
    matchesFeatures &&
    matchesMostBooked &&
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

    if (sort === 'most_booked') {
      return second.successfulBookings - first.successfulBookings;
    }

    return Date.parse(second.createdAt) - Date.parse(first.createdAt);
  });
}

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<BrowseFilters>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const bookmarkedVehicleIds = useBookmarkedVehicleIds();
  const isLoading = false;

  const vehicles = useMemo(() => {
    const filteredVehicles = availableVehicles.filter(
      (vehicle) => matchesSearch(vehicle, searchTerm) && matchesFilters(vehicle, filters, bookmarkedVehicleIds),
    );

    return sortVehicles(filteredVehicles, filters.sort ?? 'most_booked');
  }, [bookmarkedVehicleIds, filters, searchTerm]);

  const activeFilterCount =
    Number(Boolean(filters.brand)) +
    Number(Boolean(filters.bookmarkedOnly)) +
    Number(Boolean(filters.maxPrice)) +
    Number(Boolean(filters.mostBookedOnly)) +
    Number(Boolean(filters.transmission)) +
    Number(Boolean(filters.fuelType)) +
    Number(Boolean(filters.seats)) +
    Number((filters.sort ?? 'most_booked') !== 'most_booked') +
    filters.features.length;

  return (
    <View className="flex-1 bg-[#F8FAFF]">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader description="Choose the right car for your next trip." />

          <View className="mt-6">
            <SearchInput
              activeFilterCount={activeFilterCount}
              value={searchTerm}
              onSearchChange={setSearchTerm}
              onFilterPress={() => setIsFilterOpen(true)}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-between">
            <Text className="text-[13px] font-black text-[#17315F]">{vehicles.length} available vehicles</Text>
            <Text className="text-[12px] font-bold text-[#91A0B8]">Mock fleet only</Text>
          </View>

          <View className="mt-4 gap-6">
            {isLoading ? (
              <LoadingState />
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
