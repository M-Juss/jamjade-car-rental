import { CheckCircle2, Clock3 } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { BookingTimelineItem } from '@/types/booking';

export function BookingTimeline({ items }: { items: BookingTimelineItem[] }) {
  return (
    <View className="pt-1">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.completed ? CheckCircle2 : Clock3;
        const iconColor = item.completed ? '#047857' : '#9AA4B8';

        return (
          <View key={`${item.title}-${index}`} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={
                  item.completed
                    ? 'h-9 w-9 items-center justify-center rounded-full bg-success-surface'
                    : 'h-9 w-9 items-center justify-center rounded-full bg-[#F3F6FB]'
                }>
                <Icon size={18} color={iconColor} strokeWidth={2.5} />
              </View>
              {!isLast && <View className={item.completed ? 'h-12 w-px bg-success-border' : 'h-12 w-px bg-[#E5E7EB]'} />}
            </View>
            <View className="min-w-0 flex-1 pb-5">
              <Text className={item.completed ? 'text-[15px] font-black text-foreground' : 'text-[15px] font-black text-subtle-foreground'}>
                {item.title}
              </Text>
              <Text className={item.completed ? 'mt-1 text-[13px] font-semibold leading-5 text-muted-foreground' : 'mt-1 text-[13px] font-semibold leading-5 text-subtle-foreground'}>
                {item.description}
              </Text>
              <Text className={item.completed ? 'mt-2 text-[11px] font-black uppercase text-success' : 'mt-2 text-[11px] font-black uppercase text-[#A8B2C3]'}>
                {item.timestamp || 'Upcoming'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
