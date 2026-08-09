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
    iconColor: '#346EF6',
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: CalendarClock,
    iconBg: 'bg-warning-surface',
    iconColor: '#C2410C',
  },
  {
    key: 'active',
    label: 'Active',
    icon: Navigation,
    iconBg: 'bg-success-surface',
    iconColor: '#047857',
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
      {summaryItems.map((item) => {
        const Icon = item.icon;

        return (
          <View
            key={item.key}
            className="min-h-[92px] w-[146px] rounded-[24px] border border-border bg-surface p-4 shadow-md shadow-foreground/5">
            <View className="flex-row items-start justify-between gap-2">
              <View className={`${item.iconBg} h-10 w-10 items-center justify-center rounded-full`}>
                <Icon size={19} color={item.iconColor} strokeWidth={2.45} />
              </View>
              <Text className="text-[23px] font-black leading-7 text-foreground">{counts[item.key]}</Text>
            </View>
            <Text className="mt-3 text-[12px] font-black leading-4 text-muted-foreground">{item.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
