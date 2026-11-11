import {
  Armchair,
  ArrowUpDown,
  Bluetooth,
  CalendarDays,
  Camera,
  Car,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Cog,
  CreditCard,
  FileCheck2,
  Fuel,
  Gauge,
  Heart,
  Info,
  MapPin,
  MapPinned,
  Navigation,
  Palette,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { themeColors } from '@/constants/theme';
import { optionalServices, REQUIRED_DOCUMENTS } from '@/lib/browse/rental-config';
import { formatPeso } from '@/lib/browse/pricing';
import { getVehicleImageSource } from '@/lib/browse/vehicle-image-source';
import type { OptionalService, PriceBreakdown, Vehicle } from '@/types/browse';

export type SortOption = 'lowest_price' | 'highest_price' | 'saved';

export type BrowseFilters = {
  brand?: string;
  color?: Vehicle['color'];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  transmission?: Vehicle['transmission'];
  fuelType?: Vehicle['fuelType'];
  seats?: number;
};

const primary = themeColors.primary;

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function VehicleImage({
  accessibilityLabel,
  className,
  resizeMode = 'cover',
  uri,
}: {
  accessibilityLabel?: string;
  className: string;
  resizeMode?: 'cover' | 'contain';
  uri?: string | null;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const source = getVehicleImageSource(uri);

  if (!uri || failedUri === uri) {
    return (
      <View className={cx(className, 'items-center justify-center bg-muted')}>
        <Car size={34} color={themeColors.subtleForeground} strokeWidth={2.1} />
        <Text className="font-sans mt-2 text-caption text-secondary-foreground">
          No image
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      source={source}
      resizeMode={typeof source === 'number' ? 'contain' : resizeMode}
      onError={() => setFailedUri(uri)}
      className={className}
    />
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
    <View className="min-h-control flex-row items-center rounded-field border border-border bg-surface px-4">
      <Search size={20} color={themeColors.subtleForeground} strokeWidth={2.3} />
      <TextInput
        value={value}
        onChangeText={onSearchChange}
        placeholder="Search vehicle or model"
        placeholderTextColor={themeColors.subtleForeground}
        className="font-sans min-w-0 flex-1 px-3 text-[14px] font-semibold text-foreground"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount > 0 ? `Open filters, ${activeFilterCount} active` : 'Open filters'}
        hitSlop={8}
        onPress={onFilterPress}
        className="h-11 w-11 items-center justify-center rounded-field">
        <SlidersHorizontal size={18} color={primary} strokeWidth={2.5} />
        {activeFilterCount > 0 && (
          <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
            <Text className="font-sans text-[11px] font-semibold text-surface">{activeFilterCount}</Text>
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
        'min-w-0 flex-1 items-center justify-center rounded-field border px-2 py-2',
        tone === 'light' && 'border-border bg-muted',
        tone === 'dark' && 'border-surface/25 bg-surface/15',
      )}>
      <Text className={cx('font-sans', 'text-center text-[12px] font-medium leading-4', tone === 'light' ? 'text-primary' : 'text-surface')}>
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
  const vehicleTitle = [vehicle.brand, vehicle.name, vehicle.model].filter(Boolean).join(' ');

  return (
    <View className="relative">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${vehicleTitle} details`}
        onPress={onPress}
        className="w-full overflow-hidden rounded-card border border-border bg-surface p-card active:opacity-90">
        <View className="min-h-11 justify-center pl-1 pr-14">
          <Text className="font-sans text-[18px] font-semibold leading-[22px] text-foreground" numberOfLines={2}>
            {vehicleTitle}
          </Text>
        </View>

        <View className="mt-2 aspect-[16/9] w-full overflow-hidden rounded-field">
          <VehicleImage uri={vehicle.cardImage} resizeMode="contain" className="h-full w-full" />
        </View>

        <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <Text
            className="font-sans shrink text-[20px] font-semibold text-foreground">
            {formatPeso(vehicle.pricePerDay)}
            <Text className="text-[12px] font-medium text-muted-foreground">/day</Text>
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-sans text-caption font-medium text-primary">View details</Text>
            <ChevronRight size={16} color={primary} />
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isBookmarked ? `Remove ${vehicleTitle} bookmark` : `Bookmark ${vehicleTitle}`}
        accessibilityState={{ selected: isBookmarked }}
        onPress={onBookmarkPress}
        className="absolute right-3 top-3 z-10 h-11 w-11 items-center justify-center rounded-field active:opacity-70">
        <Heart
          size={21}
          color={isBookmarked ? themeColors.primary : themeColors.foreground}
          fill={isBookmarked ? themeColors.primary : 'none'}
          strokeWidth={2}
        />
      </Pressable>
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
    { label: 'Saved Cars', value: 'saved' },
  ];

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-foreground/45" onPress={onClose}>
        <Pressable className="rounded-t-sheet bg-surface px-screen pb-7 pt-4">
          <View className="mb-section h-1.5 w-12 self-center rounded-full bg-border" />
          <Text className="font-sans mb-3 text-[22px] font-semibold text-foreground">Sort vehicles</Text>
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
                  'mt-2 min-h-control flex-row items-center justify-between rounded-card border px-4',
                  isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
                )}>
                <Text className="font-sans text-[15px] font-semibold text-foreground">{option.label}</Text>
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
            <Text className={cx('font-sans', 'mt-2 text-center text-[11px] font-semibold', isActive ? 'text-primary' : 'text-secondary-foreground')}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function SelectedVehicleSummary({ vehicle }: { vehicle: Vehicle }) {
  const vehicleTitle = [vehicle.brand, vehicle.name, vehicle.model].filter(Boolean).join(' ');
  return <View className="rounded-card border border-border bg-surface p-card">
    <VehicleSummaryContent title={vehicleTitle} image={vehicle.cardImage} pricePerDay={vehicle.pricePerDay}
      color={vehicle.color} seats={vehicle.seats} transmission={vehicle.transmission} fuelType={vehicle.fuelType} />
  </View>;
}

export function VehicleSummaryContent({ title, image, pricePerDay, color, seats, transmission, fuelType, hidePrice = false }: {
  hidePrice?: boolean;
  title: string;
  image?: string | null;
  pricePerDay: number;
  color: string | null;
  seats: number;
  transmission: string;
  fuelType: string;
}) {
  const specs = [
    { icon: Palette, value: color || 'Not specified', label: 'Color' },
    { icon: Armchair, value: `${seats} seater`, label: 'Seats' },
    { icon: Cog, value: transmission, label: 'Transmission' },
    { icon: Fuel, value: fuelType === 'Gasoline' ? 'Gas' : fuelType, label: 'Fuel type' },
  ];

  return (
    <View>
      <VehicleImage
        accessibilityLabel={title}
        uri={image}
        resizeMode="contain"
        className="h-[140px] w-full"
      />
      <View className="mt-3 flex-row items-start justify-between gap-3">
        <Text className="font-sans min-w-0 flex-1 text-[18px] font-semibold leading-[22px] text-foreground">
          {title}
        </Text>
        {!hidePrice ? <Text className="font-sans text-right text-[16px] font-semibold text-primary">
          {formatPeso(pricePerDay)}
          <Text className="text-[11px] font-medium text-secondary-foreground"> / day</Text>
        </Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 border-t border-border pt-3"
        contentContainerStyle={{ alignItems: 'center', columnGap: 12 }}>
        {specs.map(({ icon: Icon, value, label }, index) => (
          <View key={label} accessible accessibilityLabel={`${label}: ${value}`} className={cx('shrink-0 flex-row items-center gap-1.5', index < specs.length - 1 && 'border-r border-border pr-3')}>
            <Icon accessible={false} size={16} color={themeColors.primary} strokeWidth={2} />
            <Text numberOfLines={1} className="font-sans text-[12px] font-semibold text-foreground">
              {value}
            </Text>
          </View>
        ))}
      </ScrollView>
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
      <View className="rounded-card border border-border bg-background p-card">
        <View className="flex-row gap-3">
          <ShieldCheck size={22} color={primary} strokeWidth={2.35} />
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[16px] font-semibold text-foreground">Owner&apos;s driver selected</Text>
            <Text className="font-sans mt-2 text-[13px] font-normal leading-5 text-secondary-foreground">
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
        'rounded-card border p-card',
        acknowledged ? 'border-primary bg-muted' : 'border-border bg-surface',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('mt-0.5 h-7 w-7 items-center justify-center rounded-full border', acknowledged ? 'border-primary bg-primary' : 'border-[#C8D4E8] bg-surface')}>
          {acknowledged && <Check size={16} color={themeColors.surface} strokeWidth={3} />}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[16px] font-semibold text-foreground">Required documents</Text>
          <Text className="font-sans mt-2 text-[13px] font-normal leading-5 text-secondary-foreground">
            I acknowledge that self-drive bookings require these documents before approval.
          </Text>
          <View className="mt-3 gap-2">
            {REQUIRED_DOCUMENTS.map((document) => (
              <View key={document} className="flex-row items-center gap-2">
                <FileCheck2 size={16} color={primary} strokeWidth={2.35} />
                <Text className="font-sans text-[13px] font-medium text-foreground">{document}</Text>
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
        'rounded-card border p-4',
        isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('h-7 w-7 items-center justify-center rounded-full border', isSelected ? 'border-primary bg-primary' : 'border-[#C8D4E8] bg-surface')}>
          {isSelected && <Check size={16} color={themeColors.surface} strokeWidth={3} />}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <Text className="font-sans min-w-0 flex-1 text-[15px] font-semibold text-foreground">{service.label}</Text>
            <Text className="font-sans text-[13px] font-semibold text-primary">{formatPeso(service.price)}</Text>
          </View>
          <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">{service.description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function BreakdownRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-2">
      <Text className={cx('font-sans', 'min-w-0 flex-1 text-[13px]', strong ? 'font-semibold text-foreground' : 'font-medium text-secondary-foreground')}>
        {label}
      </Text>
      <Text className={cx('font-sans', 'text-[14px]', strong ? 'font-semibold text-foreground' : 'font-semibold text-foreground')}>{value}</Text>
    </View>
  );
}

export function PriceBreakdownCard({ breakdown }: { breakdown: PriceBreakdown }) {
  return (
    <View className="rounded-card border border-border bg-surface p-card">
      <View className="mb-2 flex-row items-center gap-2">
        <CreditCard size={21} color={primary} strokeWidth={2.35} />
        <Text className="font-sans text-[18px] font-semibold text-foreground">Price Breakdown</Text>
      </View>
      <BreakdownRow label="Price per day" value={formatPeso(breakdown.pricePerDay)} />
      <BreakdownRow label="Number of days" value={`${breakdown.numberOfDays}`} />
      <BreakdownRow label="Rental subtotal" value={formatPeso(breakdown.subtotal)} />
      {breakdown.deliveryTollFee > 0 && <BreakdownRow label="Delivery toll" value={formatPeso(breakdown.deliveryTollFee)} />}
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
      <BreakdownRow label="Down payment (50%)" value={formatPeso(breakdown.downPaymentAmount)} />
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
    <View className="items-center rounded-card border border-border bg-surface px-card py-6">
      <Car size={24} color={primary} strokeWidth={2} />
      <Text className="font-sans mt-4 text-center text-[20px] font-semibold text-foreground">{title}</Text>
      <Text className="font-sans mt-2 text-center text-[14px] font-normal leading-5 text-secondary-foreground">{subtitle}</Text>
    </View>
  );
}

export function LoadingState() {
  return (
    <View className="gap-section">
      {[1, 2].map((item) => (
        <View key={item} className="overflow-hidden rounded-card border border-border bg-surface p-card">
          <View className="min-h-11 justify-center">
            <View className="h-6 w-3/4 rounded-field bg-muted" />
          </View>
          <View className="mt-2 aspect-[16/9] w-full rounded-field bg-muted" />
          <View className="mt-3 flex-row justify-between border-t border-border pt-3">
            <View className="h-6 w-1/3 rounded-field bg-muted" />
            <View className="h-6 w-1/4 rounded-field bg-muted" />
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
      <CircleAlert size={24} color={themeColors.destructive} strokeWidth={2} />
      <Text className="font-sans mt-4 text-center text-[22px] font-semibold text-foreground">{title}</Text>
      <Text className="font-sans mt-2 text-center text-[14px] font-normal leading-5 text-secondary-foreground">{subtitle}</Text>
      {onAction && (
        <Pressable onPress={onAction} className="mt-section min-h-control items-center justify-center rounded-field bg-primary px-7">
          <Text className="font-sans text-[15px] font-semibold text-surface">{actionLabel}</Text>
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
