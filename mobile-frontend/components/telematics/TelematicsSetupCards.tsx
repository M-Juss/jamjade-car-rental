import { ArrowRight, CheckCircle2, Gauge, LockKeyhole, Smartphone } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import { isDeviceSetupStep, setupOverview, type TelematicsSetupView } from '@/lib/telematics/setup';
import type { MobileTelematicsHandover } from '@/services/api';
import { TelematicsSetupResults } from './TelematicsSetupResults';

export function TelematicsSetupCards({ handover, disabled, onOpen, onRepeatSetup, repeatLabel }: {
  handover: MobileTelematicsHandover; disabled: boolean; onOpen: (view: TelematicsSetupView) => void;
  onRepeatSetup?: () => void; repeatLabel?: string;
}) {
  const overview = setupOverview(handover);
  return <View className="gap-3">
    {([
      { key: 'device_setup', title: 'Device setup', icon: Smartphone, stage: overview.device },
      { key: 'calibration', title: 'Calibration', icon: Gauge, stage: overview.calibration },
    ] as const).map(({ key, title, icon: Icon, stage }) => {
      const completed = stage.status === 'completed';
      const StatusIcon = completed ? CheckCircle2 : stage.canOpen ? ArrowRight : LockKeyhole;
      const device = key === 'device_setup';
      const results = handover.steps.filter(step => isDeviceSetupStep(step.type) === device);
      return <View key={key} className="rounded-card border border-border bg-surface">
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${stage.passedCount} of ${stage.total} passed${!stage.canOpen ? ', unavailable' : ''}`} accessibilityState={{ disabled: disabled || !stage.canOpen }} disabled={disabled || !stage.canOpen} onPress={() => onOpen(key)} className="gap-3 rounded-card p-card">
          <View className="flex-row items-center gap-3">
            <Icon size={21} color={themeColors.primary} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="font-sans text-body font-semibold text-foreground">{title}</Text>
              <Text className={`font-sans text-caption ${completed ? 'text-success' : 'text-secondary-foreground'}`}>{stage.passedCount} of {stage.total} passed</Text>
              {stage.status === 'failed' ? <Text className="font-sans text-caption text-secondary-foreground">Needs attention</Text> : null}
            </View>
            <StatusIcon size={19} color={completed ? themeColors.success : themeColors.secondaryForeground} />
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`${title} progress`} accessibilityValue={{ min: 0, max: stage.total, now: stage.passedCount }} className="h-1.5 overflow-hidden rounded-full bg-muted">
            <View className={`h-full rounded-full ${completed ? 'bg-success' : 'bg-primary'}`} style={{ width: `${stage.passedCount / stage.total * 100}%` }} />
          </View>
          {!stage.canOpen && !completed ? <Text className="font-sans text-caption text-secondary-foreground">{key === 'calibration' && overview.device.passedCount < overview.device.total ? 'Complete device setup first.' : 'Setup is unavailable for this handover.'}</Text> : null}
        </Pressable>
        {results.length ? <TelematicsSetupResults defaultExpanded section={title} steps={results} disabled={disabled}
          onRepeatSetup={device ? onRepeatSetup : undefined}
          repeatLabel={device && !results.some(step => step.attemptCount > 0) ? 'Start device setup' : repeatLabel} /> : null}
      </View>;
    })}
    {handover.eligibility.state === 'rental_ended' ? <View className="items-center gap-0.5"><Text accessibilityLiveRegion="polite" className="font-sans text-caption font-medium text-foreground">Rental ended</Text><Text className="font-sans text-caption text-secondary-foreground">Results are read-only</Text></View> : null}
  </View>;
}
