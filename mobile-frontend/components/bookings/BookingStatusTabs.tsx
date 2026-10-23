import { Pressable, ScrollView, Text } from 'react-native';

import { BOOKING_STATUS_FILTERS, type BookingStatusFilter } from '@/types/booking';

import { cx } from './utils';

export function BookingStatusTabs({
  selectedStatus,
  onStatusChange,
}: {
  selectedStatus: BookingStatusFilter;
  onStatusChange: (status: BookingStatusFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
      {BOOKING_STATUS_FILTERS.map((status) => {
        const isSelected = selectedStatus === status;

        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onStatusChange(status)}
            className={cx(
              'min-h-[42px] items-center justify-center rounded-full border px-4',
              isSelected ? 'border-primary bg-primary' : 'border-[#E5E7EB] bg-[#F3F4F6]',
            )}>
            <Text
              className={cx(
                'font-sans',
                'text-[13px] font-semibold',
                isSelected ? 'text-surface' : 'text-foreground',
              )}>
              {status}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
