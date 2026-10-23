import {
  Check,
  ChevronDown,
  Fuel,
  Gauge,
  Palette,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareField, KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';

import { themeColors } from '@/constants/theme';
import type { Vehicle } from '@/types/browse';
import { browsePriceRangeSchema } from '@/validation/vehicle/browse-filters';

import type { BrowseFilters, SortOption } from './BrowseComponents';

type Preference = 'transmission' | 'seats' | 'fuelType' | 'color';
const preferences: { key: Preference; label: string; icon: LucideIcon }[] = [
  { key: 'transmission', label: 'Transmission', icon: Gauge },
  { key: 'seats', label: 'Seats', icon: Users },
  { key: 'fuelType', label: 'Fuel Type', icon: Fuel },
  { key: 'color', label: 'Color', icon: Palette },
];
const sortOptions: { label: string; value: SortOption }[] = [
  { label: 'Lowest price', value: 'lowest_price' },
  { label: 'Highest price', value: 'highest_price' },
  { label: 'Saved Cars', value: 'saved' },
];

function Choice({
  label,
  selected,
  onPress,
  brandTile = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  brandTile?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-xl border px-3 py-2 ${brandTile ? 'min-h-12 grow basis-[30%]' : ''} ${selected ? 'border-primary bg-primary' : 'border-border bg-surface'}`}>
      <Text className={`font-sans text-[14px] font-medium ${selected ? 'text-surface' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FilterSheet({
  bookmarkedVehicleIds,
  filters,
  onApply,
  onClose,
  visible,
  vehicles,
}: {
  bookmarkedVehicleIds: string[];
  filters: BrowseFilters;
  onApply: (filters: BrowseFilters) => void;
  onClose: () => void;
  visible: boolean;
  vehicles: Vehicle[];
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(filters);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [expandedPreference, setExpandedPreference] = useState<Preference | null>(null);
  const brands = Array.from(new Set(vehicles.map((vehicle) => vehicle.brand).filter(Boolean))).sort();
  const options = {
    transmission: Array.from(new Set(vehicles.map((vehicle) => vehicle.transmission).filter(Boolean))).sort(),
    fuelType: Array.from(new Set(vehicles.map((vehicle) => vehicle.fuelType).filter(Boolean))).sort(),
    color: Array.from(new Set(vehicles.map((vehicle) => vehicle.color).filter(Boolean))).sort(),
    seats: Array.from(new Set(vehicles.map((vehicle) => vehicle.seats))).sort((a, b) => a - b),
  };

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setMinPrice(filters.minPrice?.toString() ?? '');
      setMaxPrice(filters.maxPrice?.toString() ?? '');
      setPriceError(null);
      setExpandedPreference(null);
    }
  }, [filters, visible]);

  const reset = () => {
    Keyboard.dismiss();
    setDraft({});
    setMinPrice('');
    setMaxPrice('');
    setPriceError(null);
    setExpandedPreference(null);
  };
  const apply = () => {
    const result = browsePriceRangeSchema.safeParse({ minPrice, maxPrice });
    if (!result.success) {
      setPriceError('Enter valid prices, with the maximum at least the minimum.');
      return;
    }
    Keyboard.dismiss();
    onApply({ ...draft, ...result.data });
    onClose();
  };
  const selectPreference = (key: Preference, value?: string | number) => {
    setDraft((current) =>
      key === 'seats'
        ? { ...current, seats: typeof value === 'number' ? value : undefined }
        : { ...current, [key]: typeof value === 'string' ? value : undefined },
    );
    setExpandedPreference(null);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss filters"
          onPress={onClose}
          className="absolute inset-0"
          style={{ backgroundColor: `${themeColors.foreground}66` }}
        />
        <View
          accessibilityViewIsModal
          className="w-full max-w-[560px] shrink self-center rounded-t-[28px] bg-surface"
          style={{
            maxHeight: Math.min(height * 0.94, height - insets.top - 12),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
            paddingBottom: Math.max(insets.bottom, 12),
          }}>
          <View className="mb-2 mt-3 h-1 w-10 self-center rounded-full bg-border" />
          <View className="mb-2 flex-row items-center gap-2">
            <SlidersHorizontal size={23} color={themeColors.foreground} strokeWidth={2} />
            <Text
              accessibilityRole="header"
              className="font-sans flex-1 text-[24px] font-semibold text-foreground">
              Filter
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <X size={22} color={themeColors.foreground} strokeWidth={2} />
            </Pressable>
          </View>
          <KeyboardFormScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
            className="shrink"
            contentContainerClassName="gap-4 pb-2">
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <Text
                  accessibilityRole="header"
                  className="font-sans text-[17px] font-semibold text-foreground">
                  All Brands
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="All brands"
                  accessibilityState={{ selected: !draft.brand }}
                  onPress={() => setDraft((current) => ({ ...current, brand: undefined }))}
                  className="min-h-11 justify-center px-3">
                  <Text className="font-sans text-[14px] font-medium text-primary">All</Text>
                </Pressable>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {brands.map((brand) => (
                  <Choice
                    key={brand}
                    brandTile
                    label={brand}
                    selected={draft.brand === brand}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        brand: current.brand === brand ? undefined : brand,
                      }))
                    }
                  />
                ))}
                {brands.length === 0 && (
                  <Text className="font-sans text-[14px] text-muted-foreground">
                    Brand options appear when vehicles are available.
                  </Text>
                )}
              </View>
            </View>
            <View>
              <Text
                accessibilityRole="header"
                className="font-sans mb-2.5 text-[17px] font-semibold text-foreground">
                Price Range <Text className="text-[13px] font-medium text-muted-foreground">(₱ / day)</Text>
              </Text>
              <View className="flex-row gap-2.5 rounded-[18px] border border-border bg-background p-2.5">
                {[
                  { label: 'Minimum', value: minPrice, setter: setMinPrice, placeholder: 'No minimum' },
                  { label: 'Maximum', value: maxPrice, setter: setMaxPrice, placeholder: 'No maximum' },
                ].map(({ label, value, setter, placeholder }) => (
                  <KeyboardAwareField key={label} className="min-w-0 flex-1">
                    <Text className="font-sans mb-2 text-[13px] font-medium text-foreground">{label}</Text>
                    <TextInput
                      accessibilityLabel={`${label} daily price in pesos`}
                      value={value}
                      onChangeText={(text) => {
                        setter(text);
                        setPriceError(null);
                      }}
                      keyboardType="decimal-pad"
                      placeholder={placeholder}
                      placeholderTextColor={themeColors.subtleForeground}
                      className="font-sans min-h-11 rounded-xl border border-border bg-surface px-3 text-[14px] text-foreground"
                    />
                  </KeyboardAwareField>
                ))}
              </View>
              {priceError && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="font-sans mt-2 text-[13px] text-destructive">
                  {priceError}
                </Text>
              )}
            </View>
            <View>
              <Text
                accessibilityRole="header"
                className="font-sans mb-2.5 text-[17px] font-semibold text-foreground">
                Other Preferences
              </Text>
              <View className="gap-2.5 rounded-[18px] border border-border bg-background p-2.5">
                {[preferences.slice(0, 2), preferences.slice(2)].map((row, index) => (
                  <View key={index} className="flex-row gap-3">
                    {row.map(({ key, label, icon: Icon }) => (
                      <View key={key} className="min-w-0 flex-1">
                        <View className="mb-2 flex-row items-center gap-1.5">
                          <Icon size={14} color={themeColors.primary} accessible={false} />
                          <Text className="font-sans min-w-0 flex-1 text-[13px] font-medium text-foreground">
                            {label}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${label}: ${draft[key] ?? 'Any'}`}
                          accessibilityState={{ expanded: expandedPreference === key }}
                          onPress={() => {
                            Keyboard.dismiss();
                            setExpandedPreference(expandedPreference === key ? null : key);
                          }}
                          className={`min-h-11 flex-row items-center gap-1.5 rounded-xl border bg-surface px-3 py-2 ${expandedPreference === key ? 'border-primary' : 'border-border'}`}>
                          <Text className="font-sans min-w-0 flex-1 text-[14px] text-foreground">
                            {draft[key] ?? 'Any'}
                          </Text>
                          <ChevronDown size={16} color={themeColors.mutedForeground} accessible={false} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ))}
                {expandedPreference && (
                  <View className="gap-1 rounded-xl border border-border bg-surface p-1">
                    <Text
                      accessibilityRole="header"
                      className="font-sans px-3 pt-2 text-[13px] font-semibold text-muted-foreground">
                      {preferences.find((item) => item.key === expandedPreference)?.label}
                    </Text>
                    {[undefined, ...options[expandedPreference]].map((value) => (
                      <Pressable
                        key={value ?? 'any'}
                        accessibilityRole="button"
                        accessibilityState={{ selected: draft[expandedPreference] === value }}
                        onPress={() => selectPreference(expandedPreference, value)}
                        className="min-h-11 flex-row items-center justify-between rounded-lg px-3 py-2">
                        <Text className="font-sans text-[14px] text-foreground">{value ?? 'Any'}</Text>
                        {draft[expandedPreference] === value && (
                          <Check size={17} color={themeColors.primary} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
            <View>
              <Text
                accessibilityRole="header"
                className="font-sans mb-2.5 text-[17px] font-semibold text-foreground">
                Sort
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {sortOptions.map((option) => (
                  <Choice
                    key={option.value}
                    label={option.value === 'saved'
                      ? `Saved Cars (${vehicles.filter((vehicle) => bookmarkedVehicleIds.includes(vehicle.id)).length})`
                      : option.label}
                    selected={draft.sort === option.value}
                    onPress={() => setDraft((current) => ({
                      ...current,
                      sort: current.sort === option.value ? undefined : option.value,
                    }))}
                  />
                ))}
              </View>
              </View>
          </KeyboardFormScrollView>
          <View className="gap-2 border-t border-border pt-3">
            <Pressable
              accessibilityRole="button"
              onPress={reset}
              className="min-h-12 items-center justify-center rounded-full border border-border bg-surface px-4 py-2">
              <Text className="font-sans text-[15px] font-medium text-foreground">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={apply}
              className="min-h-12 items-center justify-center rounded-full bg-primary px-4 py-2">
              <Text className="font-sans text-[15px] font-medium text-surface">Apply Filter</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
