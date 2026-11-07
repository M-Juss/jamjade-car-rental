import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Clock3 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import type { MobileTelematicsHandover } from '@/services/api';
import { ActionButton } from '@/components/bookings';

export function TelematicsSetupResults({ steps, onRepeatSetup, disabled, defaultExpanded = false }: { steps: MobileTelematicsHandover['steps']; onRepeatSetup?: () => void; disabled?: boolean; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <View className="rounded-card border border-border bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        accessibilityLabel={expanded ? 'Hide setup results' : 'View setup results'}
        className="min-h-control flex-row items-center gap-3 p-card"
        onPress={() => setExpanded((value) => !value)}>
        <Text className="font-sans min-w-0 flex-1 text-body font-medium text-foreground">Setup results</Text>
        <Chevron size={20} color={themeColors.mutedForeground} />
      </Pressable>
      {expanded ? (
        <View className="gap-4 px-card pb-card">
          {steps.map((step) => {
            const Icon = step.status === 'passed' ? CheckCircle2 : step.status === 'failed' ? CircleAlert : Clock3;
            return (
              <View key={step.type} className="flex-row items-start gap-3">
                <Icon size={18} color={step.status === 'passed' ? themeColors.success : step.status === 'failed' ? themeColors.destructive : themeColors.subtleForeground} />
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-sans text-body font-medium text-foreground">{step.label}</Text>
                  <Text className="font-sans text-caption capitalize text-secondary-foreground">{step.status.replaceAll('_', ' ')}</Text>
                  {step.failureReason ? <Text className="font-sans text-caption leading-5 text-destructive">{step.failureReason}</Text> : null}
                </View>
              </View>
            );
          })}
          {onRepeatSetup ? <ActionButton label="Repeat device setup" disabled={disabled} onPress={onRepeatSetup} /> : null}
        </View>
      ) : null}
    </View>
  );
}
