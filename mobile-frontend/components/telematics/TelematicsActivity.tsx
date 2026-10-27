import { Bell } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import type { useTelematicsActivity } from '@/hooks/telematics/useTelematicsActivity';
import { formatRentalDate } from '@/lib/telematics/rental-card';

export function TelematicsActivity({ activity }: { activity: ReturnType<typeof useTelematicsActivity> }) {
  return <View className="gap-3">
    <View className="flex-row items-center justify-between gap-3">
      <Text accessibilityRole="header" className="font-sans text-section font-semibold text-foreground">Activity</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Mark all activity as read" accessibilityState={{ disabled: activity.unread === 0 || activity.markingAllRead }} disabled={activity.unread === 0 || activity.markingAllRead} className="min-h-[44px] justify-center disabled:opacity-50" onPress={() => void activity.markAllRead()}>
        <Text className="font-sans text-caption font-semibold text-primary">{activity.markingAllRead ? 'Marking…' : 'Mark all read'}</Text>
      </Pressable>
    </View>
    {activity.loading && activity.items.length === 0 ? <ActivityIndicator color={themeColors.primary} /> : null}
    {activity.newerAvailable ? <ActionButton label="Show new activity" variant="soft" onPress={() => void activity.refresh()} /> : null}
    {activity.error ? <Text accessibilityLiveRegion="polite" className="font-sans text-body text-destructive">{activity.error}</Text> : null}
    {!activity.loading && !activity.error && activity.items.length === 0 ? <View className="items-center gap-2 py-6">
      <Bell size={25} color={themeColors.mutedForeground} />
      <Text className="font-sans text-body text-secondary-foreground">No activity yet</Text>
    </View> : null}
    {activity.items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.isRead ? `${item.title}, read` : `Mark ${item.title} as read`} accessibilityHint={item.isRead ? undefined : 'Marks this activity as read.'} disabled={activity.openingId !== null} onPress={() => void activity.markRead(item)} className={`flex-row items-start gap-3 rounded-field border border-border p-3 ${item.isRead ? 'bg-surface' : 'bg-muted'}`}>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-sans text-body font-semibold text-foreground">{item.title}</Text>
        <Text className="font-sans text-caption leading-5 text-secondary-foreground">{item.message}</Text>
        <Text className="font-sans text-[11px] text-secondary-foreground">{formatRentalDate(item.createdAt)}</Text>
      </View>
      {activity.openingId === item.id ? <ActivityIndicator size="small" color={themeColors.primary} /> : null}
    </Pressable>)}
    {activity.hasMore ? <ActionButton label={activity.loadingMore ? 'Loading activity…' : 'Load older activity'} disabled={activity.loadingMore || activity.loading} onPress={() => void activity.loadMore()} /> : null}
  </View>;
}
