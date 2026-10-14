import { themeColors } from '@/constants/theme';
import { CheckCircle2, Clock3 } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { BookingTimelineItem } from '@/types/booking';

export function BookingTimeline({ items }: { items: BookingTimelineItem[] }) {
  return (
    <View className="pt-1">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.completed ? CheckCircle2 : Clock3;
        const iconColor = item.completed ? themeColors.success : themeColors.subtleForeground;

        return (
          <View key={`${item.title}-${index}`} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={
                  item.completed
                    ? 'h-9 w-9 items-center justify-center rounded-full bg-success-surface'
                    : 'h-9 w-9 items-center justify-center rounded-full bg-background'
                }>
                <Icon size={18} color={iconColor} strokeWidth={2.5} />
              </View>
              {!isLast && (
                <View className={item.completed ? 'h-12 w-px bg-success-border' : 'h-12 w-px bg-[#E5E7EB]'} />
              )}
            </View>
            <View className="min-w-0 flex-1 pb-5">
              <Text
                className={
                  'font-sans ' +
                  (item.completed
                    ? 'text-[15px] font-semibold text-foreground'
                    : 'text-[15px] font-normal text-secondary-foreground')
                }>
                {item.title}
              </Text>
              <Text
                className={
                  'font-sans ' +
                  (item.completed
                    ? 'mt-1 text-[13px] font-normal leading-5 text-secondary-foreground'
                    : 'mt-1 text-[13px] font-normal leading-5 text-secondary-foreground')
                }>
                {item.description}
              </Text>
              <Text
                className={
                  'font-sans ' +
                  (item.completed
                    ? 'mt-2 text-[11px] font-semibold text-success'
                    : 'mt-2 text-[11px] font-normal text-secondary-foreground')
                }>
                {item.timestamp || 'Upcoming'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
