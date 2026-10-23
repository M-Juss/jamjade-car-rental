import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { InfoRow } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { movementLabel, type RcResearchSession } from '@/lib/research/rc-research';
import type { RcIntensity, RcMovement } from '@/validation/research/rc-research';

export function RcSessionSummary({ session, movement, intensity }: { session: RcResearchSession; movement: RcMovement; intensity: RcIntensity }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="rounded-card border border-border bg-surface p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground" numberOfLines={1}>{session.name}</Text>
        <Pressable accessibilityRole="button" aria-expanded={expanded} accessibilityLabel="Session details" onPress={() => setExpanded(value => !value)}
          className="min-h-control flex-row items-center gap-1 px-2">
          <Text className="font-sans text-caption font-semibold text-primary">Details</Text>
          {expanded ? <ChevronUp size={18} color={themeColors.primary} /> : <ChevronDown size={18} color={themeColors.primary} />}
        </Pressable>
      </View>
      {expanded ? <View className="mt-2 border-t border-border pt-1">
        <InfoRow label="Intended movement" value={movementLabel(movement, intensity)} />
        <InfoRow label="Surface" value={session.surface} />
        <InfoRow label="Slope" value={session.slope} />
        <InfoRow label="Mount orientation" value={session.mount_orientation} />
        <InfoRow label="Battery" value={session.battery_condition} /><InfoRow label="Added load" value="None" />
      </View> : null}
    </View>
  );
}
