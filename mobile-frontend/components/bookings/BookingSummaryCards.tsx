import { themeColors } from '@/constants/theme';
import { CalendarClock, CheckCircle2, ClipboardList, Navigation } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { getBookingSummaryCounts } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';

const summaryItems = [
  {
    key: 'total',
    label: 'Total Bookings',
    icon: ClipboardList,
    iconBg: 'bg-muted',
    iconColor: themeColors.primary,
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: CalendarClock,
    iconBg: 'bg-warning-surface',
    iconColor: themeColors.warning,
  },
  {
    key: 'active',
    label: 'Active',
    icon: Navigation,
    iconBg: 'bg-success-surface',
    iconColor: themeColors.success,
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    iconBg: 'bg-[#F0FDF4]',
    iconColor: '#166534',
  },
] as const;

export function BookingSummaryCards({ bookings }: { bookings: Booking[] }) {
  const counts = getBookingSummaryCounts(bookings);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
      {summaryItems.map((item) => {
        const Icon = item.icon;

        return (
          <View
            key={item.key}
            className="min-h-[92px] w-[146px] rounded-[24px] border border-border bg-surface p-4 ">
            <View className="flex-row items-start justify-between gap-2">
              <View className={`${item.iconBg} h-10 w-10 items-center justify-center rounded-full`}>
                <Icon size={19} color={item.iconColor} strokeWidth={2.45} />
              </View>
              <Text className="font-sans text-[23px] font-semibold leading-7 text-foreground">
                {counts[item.key]}
              </Text>
            </View>
            <Text className="font-sans mt-3 text-[12px] font-normal leading-4 text-secondary-foreground">
              {item.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
