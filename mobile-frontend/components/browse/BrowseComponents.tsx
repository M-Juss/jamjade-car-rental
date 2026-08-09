import {
  ArrowLeft,
  ArrowUpDown,
  Bluetooth,
  Bookmark,
  CalendarDays,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CreditCard,
  FileCheck2,
  Fuel,
  Gauge,
  Info,
  MapPin,
  MapPinned,
  Navigation,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  type ScrollView as ScrollViewType,
  Text,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
  Animated,
  useWindowDimensions,
} from 'react-native';

import { optionalServices, REQUIRED_DOCUMENTS } from '@/lib/browse/rental-config';
import { formatPeso } from '@/lib/browse/pricing';
import type { OptionalService, PriceBreakdown, Vehicle } from '@/types/browse';

export type SortOption = 'lowest_price' | 'highest_price' | 'most_booked' | 'newest';

export type BrowseFilters = {
  bookmarkedOnly?: boolean;
  maxPrice?: number;
  mostBookedOnly?: boolean;
  sort?: SortOption;
  transmission?: Vehicle['transmission'];
  fuelType?: Vehicle['fuelType'];
  seats?: number;
  features: string[];
};

const primary = '#346EF6';
const ink = '#17315F';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function VehicleImage({
  className,
  uri,
}: {
  className: string;
  uri?: string | null;
}) {
  if (!uri) {
    return (
      <View className={cx(className, 'items-center justify-center bg-muted')}>
        <Car size={34} color="#91A0B8" strokeWidth={2.1} />
        <Text className="mt-2 text-[11px] font-black uppercase tracking-[0.5px] text-subtle-foreground">
          No image
        </Text>
      </View>
    );
  }

  return <Image source={{ uri }} resizeMode="cover" className={className} />;
}

function SmallIconButton({
  accessibilityLabel,
  iconFill = 'none',
  icon: Icon,
  onPress,
  variant = 'light',
}: {
  accessibilityLabel: string;
  iconFill?: string;
  icon: LucideIcon;
  onPress?: () => void;
  variant?: 'light' | 'dark';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      className={cx(
        'h-12 w-12 items-center justify-center rounded-full border',
        variant === 'light' && 'border-surface/55 bg-surface/25',
        variant === 'dark' && 'border-border bg-surface',
      )}>
      <Icon size={22} color={variant === 'light' ? '#FFFFFF' : ink} fill={iconFill} strokeWidth={2.35} />
    </Pressable>
  );
}

export function SearchInput({
  activeFilterCount = 0,
  onFilterPress,
  onSearchChange,
  value,
}: {
  activeFilterCount?: number;
  value: string;
  onSearchChange: (value: string) => void;
  onFilterPress: () => void;
}) {
  return (
    <View className="min-h-[56px] flex-row items-center rounded-full border border-border bg-surface px-4 shadow-md shadow-foreground/5">
      <Search size={20} color="#7B879C" strokeWidth={2.3} />
      <TextInput
        value={value}
        onChangeText={onSearchChange}
        placeholder="Search vehicle or model"
        placeholderTextColor="#9AA4B8"
        className="min-w-0 flex-1 px-3 text-[14px] font-semibold text-foreground"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount > 0 ? `Open filters, ${activeFilterCount} active` : 'Open filters'}
        hitSlop={8}
        onPress={onFilterPress}
        className="h-10 w-10 items-center justify-center rounded-full bg-muted">
        <SlidersHorizontal size={18} color={primary} strokeWidth={2.5} />
        {activeFilterCount > 0 && (
          <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
            <Text className="text-[10px] font-black text-surface">{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function FeatureBadge({ label, tone = 'light' }: { label: string; tone?: 'light' | 'dark' }) {
  return (
    <View
      className={cx(
        'rounded-full border px-3 py-1.5',
        tone === 'light' && 'border-border bg-muted',
        tone === 'dark' && 'border-surface/25 bg-surface/15',
      )}>
      <Text className={cx('text-[11px] font-extrabold', tone === 'light' ? 'text-primary' : 'text-surface')}>
        {label}
      </Text>
    </View>
  );
}

export function VehicleCard({
  isBookmarked,
  onBookmarkPress,
  onPress,
  vehicle,
}: {
  isBookmarked: boolean;
  vehicle: Vehicle;
  onBookmarkPress: () => void;
  onPress: () => void;
}) {
  const specs = [
    { icon: Users, title: 'Seats', value: `${vehicle.seats} seats` },
    { icon: Gauge, title: 'Drive', value: vehicle.transmission },
    { icon: Fuel, title: 'Fuel Type', value: vehicle.fuelType },
    { icon: Sparkles, title: 'Color', value: vehicle.color },
  ];

  return (
    <View className="relative">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${vehicle.name} details`}
        onPress={onPress}
        className="overflow-hidden rounded-[26px] border border-[#D8E6FF] bg-surface p-4 shadow-lg shadow-foreground/10">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 pr-12">
            <Text className="text-[21px] font-black leading-[25px] text-[#10203F]" numberOfLines={2}>
              {vehicle.name}
            </Text>
            <Text className="mt-1 text-[12px] font-bold text-[#6E81A6]" numberOfLines={1}>
              {vehicle.brand} · {vehicle.model}
            </Text>
            <View className="mt-2 flex-row items-baseline gap-1.5">
              <Text className="text-[18px] font-black leading-[21px] text-foreground" numberOfLines={1}>
                {formatPeso(vehicle.pricePerDay)}
              </Text>
              <Text className="text-[11px] font-black uppercase tracking-[0.45px] text-[#6E81A6]">/day</Text>
            </View>
          </View>
        </View>

        <View className="relative mt-3 h-[174px] overflow-hidden rounded-[22px] border border-[#DCE8FF] bg-muted">
          <VehicleImage uri={vehicle.cardImage} className="h-full w-full" />
        </View>

        <View className="mt-3 flex-row rounded-[18px] border border-border bg-background px-2 py-2">
          {specs.map(({ icon: Icon, title, value }, index) => (
            <View
              key={title}
              className={cx(
                'min-h-[62px] min-w-0 flex-1 items-center justify-center px-1 py-1.5',
                index < specs.length - 1 && 'border-r border-[#E1EBFF]',
              )}>
              <View className="h-7 w-7 items-center justify-center rounded-full bg-surface">
                <Icon size={13} color="#346EF6" strokeWidth={2.55} />
              </View>
              <View className="mt-1 w-full min-w-0 items-center px-0.5">
                <Text className="w-full text-center text-[8px] font-black uppercase tracking-[0.3px] text-[#7B879C]" numberOfLines={1}>
                  {title}
                </Text>
                <Text
                  adjustsFontSizeToFit
                  className="mt-0.5 w-full text-center text-[10px] font-black leading-[12px] text-[#10203F]"
                  minimumFontScale={0.75}
                  numberOfLines={2}>
                  {value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-3 flex-row items-center justify-between rounded-[18px] bg-muted px-4 py-3">
          <Text className="text-[12px] font-black uppercase tracking-[0.45px] text-primary">Full info</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-[12px] font-black text-foreground">View details</Text>
            <ChevronRight size={16} color="#346EF6" strokeWidth={2.8} />
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isBookmarked ? `Remove ${vehicle.name} bookmark` : `Bookmark ${vehicle.name}`}
        hitSlop={8}
        onPress={onBookmarkPress}
        className="absolute right-4 top-4 z-10 h-10 w-10 items-center justify-center rounded-full border border-border bg-[#F7FAFF]">
        <Bookmark size={18} color="#346EF6" fill={isBookmarked ? '#346EF6' : 'none'} strokeWidth={2.7} />
      </Pressable>
    </View>
  );
}

export function VehicleImageTabs({ activeIndex, count }: { activeIndex: number; count: number }) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-surface/35">
          <View className={cx('h-full rounded-full', index <= activeIndex ? 'bg-surface' : 'bg-transparent')} />
        </View>
      ))}
    </View>
  );
}

export function VehicleStoryCarousel({
  activeIndex,
  isBookmarked,
  onActiveIndexChange,
  onBackPress,
  onBookmarkPress,
  vehicle,
}: {
  vehicle: Vehicle;
  activeIndex: number;
  isBookmarked: boolean;
  onActiveIndexChange: (index: number) => void;
  onBookmarkPress: () => void;
  onBackPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewType>(null);
  const displayImages = vehicle.images.length > 0
    ? vehicle.images
    : vehicle.cardImage
      ? [vehicle.cardImage]
      : [];
  const imageCount = Math.max(displayImages.length, 1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: width * activeIndex, animated: true });
  }, [activeIndex, width]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    onActiveIndexChange(Math.min(imageCount - 1, Math.max(0, nextIndex)));
  };

  return (
    <View className="h-[530px] bg-[#0B1220]">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        snapToInterval={width}
        decelerationRate="fast">
        {displayImages.length > 0 ? (
          displayImages.map((source) => (
            <ImageBackground key={source} source={{ uri: source }} resizeMode="cover" className="h-[530px] w-screen">
              <View className="absolute left-0 right-0 top-0 h-[150px] bg-black/10" />
            </ImageBackground>
          ))
        ) : (
          <View className="h-[530px] w-screen items-center justify-center bg-[#172033]">
            <Car size={58} color="#91A0B8" strokeWidth={1.9} />
            <Text className="mt-3 text-[13px] font-black uppercase tracking-[0.7px] text-subtle-foreground">
              No vehicle images
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute left-5 right-5 top-14">
        <VehicleImageTabs activeIndex={activeIndex} count={imageCount} />
      </View>

      <View className="absolute left-5 right-5 top-24 flex-row items-center justify-between">
        <SmallIconButton accessibilityLabel="Go back" icon={ArrowLeft} onPress={onBackPress} />
        <SmallIconButton
          accessibilityLabel={isBookmarked ? `Remove ${vehicle.name} bookmark` : `Bookmark ${vehicle.name}`}
          icon={Bookmark}
          iconFill={isBookmarked ? '#FFFFFF' : 'none'}
          onPress={onBookmarkPress}
        />
      </View>
    </View>
  );
}

export function VehicleSpecsGrid({ vehicle }: { vehicle: Vehicle }) {
  const specs = [
    { icon: Users, label: 'Seats', value: `${vehicle.seats}` },
    { icon: Gauge, label: 'Drive', value: vehicle.transmission },
    { icon: Fuel, label: 'Fuel Type', value: vehicle.fuelType },
    { icon: Sparkles, label: 'Color', value: vehicle.color },
  ];

  return (
    <View className="flex-row flex-wrap gap-3">
      {specs.map(({ icon: Icon, label, value }) => (
        <View key={label} className="min-h-[92px] flex-1 basis-[47%] rounded-3xl border border-[#EAF0FB] bg-surface p-4">
          <Icon size={20} color={primary} strokeWidth={2.35} />
          <Text className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.8px] text-subtle-foreground">{label}</Text>
          <Text className="mt-1 text-[15px] font-black text-foreground" numberOfLines={1}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function VehicleDetailsDrawer({ onBookNow, vehicle }: { vehicle: Vehicle; onBookNow: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDrawerLifted, setIsDrawerLifted] = useState(false);
  const { height } = useWindowDimensions();
  const drawerLift = useRef(new Animated.Value(0)).current;
  const isDrawerLiftedRef = useRef(false);
  const dragStartLiftRef = useRef(0);
  const description = vehicle.description || 'No vehicle description has been added yet.';
  const isDescriptionLong = description.length > 128;
  const displayDescription = isExpanded || !isDescriptionLong
    ? description
    : `${description.slice(0, 128)}...`;
  const drawerDefaultTop = 490;
  const drawerLiftDistance = Math.max(360, Math.min(470, drawerDefaultTop - height * 0.05));
  const drawerTranslateY = drawerLift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -drawerLiftDistance],
  });

  const setDrawerLifted = (shouldLift: boolean) => {
    isDrawerLiftedRef.current = shouldLift;
    setIsDrawerLifted(shouldLift);
    drawerLift.stopAnimation();
    Animated.timing(drawerLift, {
      toValue: shouldLift ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  };

  const drawerPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
    onPanResponderGrant: () => {
      drawerLift.stopAnimation((value) => {
        dragStartLiftRef.current = value;
      });
    },
    onPanResponderMove: (_, gestureState) => {
      const nextLift = dragStartLiftRef.current - gestureState.dy / drawerLiftDistance;
      drawerLift.setValue(Math.max(0, Math.min(1, nextLift)));
    },
    onPanResponderRelease: (_, gestureState) => {
      const shouldExpand = gestureState.dy < -50 || gestureState.vy < -0.35;
      const shouldCollapse = gestureState.dy > 50 || gestureState.vy > 0.35;

      if (shouldExpand) {
        setDrawerLifted(true);
        return;
      }

      if (shouldCollapse) {
        setDrawerLifted(false);
        return;
      }

      setDrawerLifted(dragStartLiftRef.current >= 0.5);
    },
    onPanResponderTerminate: () => {
      setDrawerLifted(isDrawerLiftedRef.current);
    },
    onPanResponderTerminationRequest: () => false,
  });

  return (
    <Animated.View
      {...drawerPanResponder.panHandlers}
      style={{
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        flex: 1,
        marginBottom: -drawerLiftDistance,
        marginTop: -40,
        overflow: 'hidden',
        transform: [{ translateY: drawerTranslateY }],
      }}>
      <Pressable
        accessibilityLabel={isDrawerLifted ? 'Move vehicle details down' : 'Move vehicle details up'}
        accessibilityRole="button"
        onPress={() => setDrawerLifted(!isDrawerLiftedRef.current)}
        className="items-center border-b border-[#F1F4FA] bg-surface px-5 pb-3 pt-4">
        <View className="h-1.5 w-12 rounded-full bg-[#D7DDE8]" />
        <View className="mt-2 flex-row items-center gap-1.5">
          {isDrawerLifted ? (
            <ChevronDown size={16} color="#6C7A96" strokeWidth={2.6} />
          ) : (
            <ChevronUp size={16} color="#6C7A96" strokeWidth={2.6} />
          )}
          <Text className="text-[11px] font-black uppercase tracking-[0.6px] text-muted-foreground">
            {isDrawerLifted ? 'Drag down to view images' : 'Drag up for details'}
          </Text>
        </View>
      </Pressable>

      <View className="flex-1 overflow-hidden px-5 pb-28 pt-5">
        <View className="flex-row items-start gap-4">
          <View className="min-w-0 flex-1">
            <Text className="text-[31px] font-black leading-[36px] text-[#0F172A]">{vehicle.name}</Text>
            <Text className="mt-1 text-[13px] font-bold text-muted-foreground">
              {vehicle.brand} · {vehicle.model}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-[21px] font-black text-foreground">{formatPeso(vehicle.pricePerDay)}</Text>
            <Text className="text-[12px] font-extrabold text-subtle-foreground">/ day</Text>
          </View>
        </View>

        <Text className="mt-4 text-[15px] font-semibold leading-6 text-muted-foreground">
          {displayDescription}
          {!isExpanded && isDescriptionLong && (
            <Text className="font-black text-foreground" onPress={() => setIsExpanded(true)}>
              {' '}
              Read more
            </Text>
          )}
        </Text>

        <View className="mt-7">
          <Text className="mb-3 text-[20px] font-black text-[#0F172A]">Specs</Text>
          <VehicleSpecsGrid vehicle={vehicle} />
        </View>

        <View className="mt-7">
          <Text className="mb-3 text-[20px] font-black text-[#0F172A]">Features</Text>
          {vehicle.features.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {vehicle.features.map((feature) => (
                <FeatureBadge key={feature} label={feature} />
              ))}
            </View>
          ) : (
            <Text className="text-[13px] font-semibold text-muted-foreground">
              No additional features have been listed.
            </Text>
          )}
        </View>
      </View>

      <View className="absolute bottom-0 left-0 right-0 border-t border-[#EAF0FB] bg-surface/95 px-5 pb-6 pt-4">
        <View className="flex-row items-center gap-4">
          <View className="flex-1">
            <Text className="text-[12px] font-bold text-subtle-foreground">Starts at</Text>
            <Text className="text-[20px] font-black text-foreground">
              {formatPeso(vehicle.pricePerDay)}
              <Text className="text-[12px] font-extrabold text-subtle-foreground"> / day</Text>
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onBookNow}
            className="min-h-[58px] flex-[1.1] items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
            <Text className="text-[16px] font-black text-surface">Book Now</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function FilterChip({
  isSelected,
  label,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cx(
        'rounded-full border px-4 py-2.5',
        isSelected ? 'border-primary bg-primary' : 'border-border bg-surface',
      )}>
      <Text className={cx('text-[13px] font-black', isSelected ? 'text-surface' : 'text-foreground')}>{label}</Text>
    </Pressable>
  );
}

export function FilterSheet({
  bookmarkedVehicleIds,
  filters,
  onApply,
  onClose,
  visible,
  vehicles: availableVehicleOptions,
}: {
  bookmarkedVehicleIds: string[];
  visible: boolean;
  filters: BrowseFilters;
  vehicles: Vehicle[];
  onApply: (filters: BrowseFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BrowseFilters>(filters);
  const features = Array.from(new Set(availableVehicleOptions.flatMap((vehicle) => vehicle.features))).slice(0, 10);
  const transmissions = Array.from(new Set(availableVehicleOptions.map((vehicle) => vehicle.transmission))).sort();
  const fuelTypes = Array.from(new Set(availableVehicleOptions.map((vehicle) => vehicle.fuelType))).sort();
  const seatOptions = Array.from(new Set(availableVehicleOptions.map((vehicle) => vehicle.seats))).sort((a, b) => a - b);
  const priceOptions = Array.from(new Set(availableVehicleOptions.map((vehicle) => vehicle.pricePerDay))).sort((a, b) => a - b);
  const sortOptions: { label: string; value: SortOption }[] = [
    { label: 'Most booked', value: 'most_booked' },
    { label: 'Lowest price', value: 'lowest_price' },
    { label: 'Highest price', value: 'highest_price' },
    { label: 'Newest', value: 'newest' },
  ];
  const bookmarkedCount = availableVehicleOptions.filter((vehicle) => bookmarkedVehicleIds.includes(vehicle.id)).length;
  const mostBookedCount = availableVehicleOptions.filter((vehicle) => vehicle.isMostBooked).length;

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [filters, visible]);

  const toggleFeature = (feature: string) => {
    setDraft((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((item) => item !== feature)
        : [...current.features, feature],
    }));
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-[#0B1220]/45" onPress={onClose}>
        <Pressable className="max-h-[86%] rounded-t-[32px] bg-surface px-5 pb-7 pt-4">
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-[#D7DDE8]" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[22px] font-black text-foreground">Filters</Text>
            <Pressable accessibilityRole="button" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F6FB]">
              <X size={19} color={ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <FilterGroup title="Quick filters">
              <FilterChip
                label={`Bookmarked cars (${bookmarkedCount})`}
                isSelected={Boolean(draft.bookmarkedOnly)}
                onPress={() =>
                  setDraft((current) => ({ ...current, bookmarkedOnly: !current.bookmarkedOnly }))
                }
              />
              <FilterChip
                label={`Most booked cars (${mostBookedCount})`}
                isSelected={Boolean(draft.mostBookedOnly)}
                onPress={() =>
                  setDraft((current) => ({ ...current, mostBookedOnly: !current.mostBookedOnly }))
                }
              />
            </FilterGroup>

            <FilterGroup title="Sort">
              {sortOptions.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  isSelected={(draft.sort ?? 'most_booked') === option.value}
                  onPress={() => setDraft((current) => ({ ...current, sort: option.value }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Price range">
              {priceOptions.map((price) => (
                <FilterChip
                  key={price}
                  label={`Up to ${formatPeso(price)}`}
                  isSelected={draft.maxPrice === price}
                  onPress={() => setDraft((current) => ({ ...current, maxPrice: current.maxPrice === price ? undefined : price }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Transmission">
              {transmissions.map((transmission) => (
                <FilterChip
                  key={transmission}
                  label={transmission}
                  isSelected={draft.transmission === transmission}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      transmission: current.transmission === transmission ? undefined : transmission,
                    }))
                  }
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Fuel type">
              {fuelTypes.map((fuelType) => (
                <FilterChip
                  key={fuelType}
                  label={fuelType}
                  isSelected={draft.fuelType === fuelType}
                  onPress={() =>
                    setDraft((current) => ({ ...current, fuelType: current.fuelType === fuelType ? undefined : fuelType }))
                  }
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Seats">
              {seatOptions.map((seats) => (
                <FilterChip
                  key={seats}
                  label={`${seats} seats`}
                  isSelected={draft.seats === seats}
                  onPress={() => setDraft((current) => ({ ...current, seats: current.seats === seats ? undefined : seats }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Features">
              {features.map((feature) => (
                <FilterChip key={feature} label={feature} isSelected={draft.features.includes(feature)} onPress={() => toggleFeature(feature)} />
              ))}
            </FilterGroup>
          </ScrollView>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft({ features: [], sort: 'most_booked' })}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full border border-border bg-surface">
              <Text className="text-[15px] font-black text-foreground">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onApply(draft);
                onClose();
              }}
              className="min-h-[54px] flex-1 items-center justify-center rounded-full bg-primary">
              <Text className="text-[15px] font-black text-surface">Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterGroup({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-3 text-[13px] font-black uppercase tracking-[0.9px] text-subtle-foreground">{title}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

export function SortSheet({
  onClose,
  onSelect,
  selected,
  visible,
}: {
  visible: boolean;
  selected: SortOption;
  onSelect: (sort: SortOption) => void;
  onClose: () => void;
}) {
  const options: { label: string; value: SortOption }[] = [
    { label: 'Lowest price', value: 'lowest_price' },
    { label: 'Highest price', value: 'highest_price' },
    { label: 'Most booked', value: 'most_booked' },
    { label: 'Newest', value: 'newest' },
  ];

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-[#0B1220]/45" onPress={onClose}>
        <Pressable className="rounded-t-[32px] bg-surface px-5 pb-7 pt-4">
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-[#D7DDE8]" />
          <Text className="mb-3 text-[22px] font-black text-foreground">Sort vehicles</Text>
          {options.map((option) => {
            const isSelected = selected === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className={cx(
                  'mt-2 min-h-[56px] flex-row items-center justify-between rounded-2xl border px-4',
                  isSelected ? 'border-primary bg-muted' : 'border-[#EAF0FB] bg-surface',
                )}>
                <Text className="text-[15px] font-black text-foreground">{option.label}</Text>
                {isSelected && <Check size={20} color={primary} strokeWidth={2.7} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BookingStepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Details', 'Review', 'Payment'];

  return (
    <View className="flex-row items-center gap-2">
      {steps.map((label, index) => {
        const currentStep = index + 1;
        const isActive = currentStep <= step;

        return (
          <View key={label} className="min-w-0 flex-1">
            <View className={cx('h-1.5 rounded-full', isActive ? 'bg-primary' : 'bg-border')} />
            <Text className={cx('mt-2 text-center text-[11px] font-black', isActive ? 'text-primary' : 'text-subtle-foreground')}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function SelectedVehicleSummary({ vehicle }: { vehicle: Vehicle }) {
  return (
    <View className="flex-row gap-3 rounded-[28px] border border-border bg-surface p-3 shadow-md shadow-foreground/5">
      <VehicleImage uri={vehicle.cardImage} className="h-[104px] w-[116px] rounded-[22px]" />
      <View className="min-w-0 flex-1 justify-between py-1">
        <View>
          <Text className="text-[18px] font-black leading-[22px] text-foreground" numberOfLines={2}>
            {vehicle.name}
          </Text>
          <Text className="mt-1 text-[12px] font-bold text-muted-foreground">
            {vehicle.seats} seats · {vehicle.transmission} · {vehicle.fuelType}
          </Text>
        </View>
        <Text className="text-[17px] font-black text-primary">
          {formatPeso(vehicle.pricePerDay)}
          <Text className="text-[11px] font-extrabold text-subtle-foreground"> / day</Text>
        </Text>
      </View>
    </View>
  );
}

export function RequiredDocumentsCard({
  acknowledged,
  driverOption,
  onToggleAcknowledged,
}: {
  driverOption: 'self_drive' | 'owners_driver';
  acknowledged: boolean;
  onToggleAcknowledged: () => void;
}) {
  if (driverOption === 'owners_driver') {
    return (
      <View className="rounded-[28px] border border-border bg-background p-5">
        <View className="flex-row gap-3">
          <ShieldCheck size={22} color={primary} strokeWidth={2.35} />
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-black text-foreground">Owner&apos;s driver selected</Text>
            <Text className="mt-2 text-[13px] font-semibold leading-5 text-muted-foreground">
              Owner&apos;s driver does not require self-drive documents. Additional fees may apply depending on location.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: acknowledged }}
      onPress={onToggleAcknowledged}
      className={cx(
        'rounded-[28px] border p-5',
        acknowledged ? 'border-primary bg-muted' : 'border-border bg-surface',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('mt-0.5 h-7 w-7 items-center justify-center rounded-full border', acknowledged ? 'border-primary bg-primary' : 'border-[#C8D4E8] bg-surface')}>
          {acknowledged && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-foreground">Required documents</Text>
          <Text className="mt-2 text-[13px] font-semibold leading-5 text-muted-foreground">
            I acknowledge that self-drive bookings require these documents before approval.
          </Text>
          <View className="mt-3 gap-2">
            {REQUIRED_DOCUMENTS.map((document) => (
              <View key={document} className="flex-row items-center gap-2">
                <FileCheck2 size={16} color={primary} strokeWidth={2.35} />
                <Text className="text-[13px] font-bold text-foreground">{document}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function OptionalServiceCard({
  isSelected,
  onToggle,
  service,
}: {
  service: OptionalService;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      className={cx(
        'rounded-[24px] border p-4',
        isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('h-7 w-7 items-center justify-center rounded-full border', isSelected ? 'border-primary bg-primary' : 'border-[#C8D4E8] bg-surface')}>
          {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <Text className="min-w-0 flex-1 text-[15px] font-black text-foreground">{service.label}</Text>
            <Text className="text-[13px] font-black text-primary">{formatPeso(service.price)}</Text>
          </View>
          <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">{service.description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function BreakdownRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-2">
      <Text className={cx('min-w-0 flex-1 text-[13px]', strong ? 'font-black text-foreground' : 'font-bold text-muted-foreground')}>
        {label}
      </Text>
      <Text className={cx('text-[14px]', strong ? 'font-black text-foreground' : 'font-extrabold text-foreground')}>{value}</Text>
    </View>
  );
}

export function PriceBreakdownCard({ breakdown }: { breakdown: PriceBreakdown }) {
  return (
    <View className="rounded-[28px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
      <View className="mb-2 flex-row items-center gap-2">
        <CreditCard size={21} color={primary} strokeWidth={2.35} />
        <Text className="text-[18px] font-black text-foreground">Price Breakdown</Text>
      </View>
      <BreakdownRow label="Price per day" value={formatPeso(breakdown.pricePerDay)} />
      <BreakdownRow label="Number of days" value={`${breakdown.numberOfDays}`} />
      <BreakdownRow label="Rental subtotal" value={formatPeso(breakdown.subtotal)} />
      {breakdown.deliveryFee > 0 && (
        <BreakdownRow label="Delivery fee" value={formatPeso(breakdown.deliveryFee)} />
      )}
      {breakdown.ownerDriverFee > 0 && (
        <BreakdownRow
          label={`Owner's driver fee (${formatPeso(breakdown.ownerDriverRatePerDay ?? 0)} / day)`}
          value={formatPeso(breakdown.ownerDriverFee)}
        />
      )}
      <View className="my-2 h-px bg-border" />
      <BreakdownRow label="Total amount" value={formatPeso(breakdown.totalAmount)} strong />
      <BreakdownRow label="Down payment (30%)" value={formatPeso(breakdown.downPaymentAmount)} />
      <BreakdownRow label="Remaining balance" value={formatPeso(breakdown.remainingBalance)} />
    </View>
  );
}

export function EmptyState({
  subtitle = 'Try adjusting your search or filters.',
  title = 'No vehicles available',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center rounded-[32px] border border-dashed border-[#C8D4E8] bg-surface p-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Car size={30} color={primary} strokeWidth={2.25} />
      </View>
      <Text className="mt-4 text-center text-[20px] font-black text-foreground">{title}</Text>
      <Text className="mt-2 text-center text-[14px] font-semibold leading-5 text-muted-foreground">{subtitle}</Text>
    </View>
  );
}

export function LoadingState() {
  return (
    <View className="gap-5">
      {[1, 2].map((item) => (
        <View key={item} className="h-[410px] overflow-hidden rounded-[32px] bg-[#E9EFFA]">
          <View className="absolute bottom-0 left-0 right-0 gap-3 p-5">
            <View className="h-8 w-3/4 rounded-full bg-surface/70" />
            <View className="h-4 w-1/2 rounded-full bg-surface/60" />
            <View className="mt-8 flex-row gap-2">
              <View className="h-[68px] flex-1 rounded-2xl bg-surface/60" />
              <View className="h-[68px] flex-1 rounded-2xl bg-surface/60" />
              <View className="h-[68px] flex-1 rounded-2xl bg-surface/60" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ErrorState({
  actionLabel = 'Back to Browse',
  onAction,
  subtitle = 'We could not load that vehicle.',
  title = 'Vehicle unavailable',
}: {
  actionLabel?: string;
  title?: string;
  subtitle?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F1]">
        <CircleAlert size={31} color="#D92D20" strokeWidth={2.3} />
      </View>
      <Text className="mt-4 text-center text-[22px] font-black text-foreground">{title}</Text>
      <Text className="mt-2 text-center text-[14px] font-semibold leading-5 text-muted-foreground">{subtitle}</Text>
      {onAction && (
        <Pressable onPress={onAction} className="mt-6 min-h-[52px] items-center justify-center rounded-full bg-primary px-7">
          <Text className="text-[15px] font-black text-surface">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export const browseIcons = {
  ArrowUpDown,
  CalendarDays,
  Car,
  Check,
  CircleCheck,
  CreditCard,
  FileCheck2,
  Fuel,
  Gauge,
  Info,
  MapPin,
  MapPinned,
  Navigation,
  Bluetooth,
  Camera,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  Users,
};

export { optionalServices };
