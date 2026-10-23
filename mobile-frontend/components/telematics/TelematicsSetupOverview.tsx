import { CheckCircle2, CircleAlert, Clock3, Gauge, KeyRound, LockKeyhole, Smartphone, type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { setupOverview, type SetupOverviewStage, type TelematicsSetupView } from '@/lib/telematics/setup';
import type { MobileTelematicsHandover } from '@/services/api';

const stageLabels = {
  locked: 'Locked', available: 'Ready', in_progress: 'In progress', failed: 'Needs attention', completed: 'Completed',
};

function SetupStageCard({ title, icon, progress, lockedReason, action, disabled, onOpen }: {
  title: string;
  icon: LucideIcon;
  progress: SetupOverviewStage;
  lockedReason: string;
  action: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  const completed = progress.status === 'completed';
  const failed = progress.status === 'failed';
  const Icon = completed ? CheckCircle2 : failed ? CircleAlert : progress.canOpen ? Clock3 : LockKeyhole;
  const color = completed ? themeColors.success : failed ? themeColors.destructive : themeColors.secondaryForeground;
  return (
    <SectionCard title={title} icon={icon}>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-sans text-body text-secondary-foreground">{progress.passedCount} of {progress.total} passed</Text>
        <View className="flex-row items-center gap-1.5">
          <Icon size={16} color={color} accessible={false} />
          <Text className={`font-sans text-caption font-medium ${completed ? 'text-success' : failed ? 'text-destructive' : 'text-secondary-foreground'}`}>{stageLabels[progress.status]}</Text>
        </View>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={`${title} checks passed`} accessibilityValue={{ min: 0, max: progress.total, now: progress.passedCount }} className="h-1.5 overflow-hidden rounded-full bg-border">
        <View className={`h-full rounded-full ${completed ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress.passedCount / progress.total * 100}%` }} />
      </View>
      {!progress.canOpen && !completed ? <Text className="font-sans mt-3 text-body leading-6 text-secondary-foreground">{lockedReason}</Text> : null}
      {progress.canOpen ? <ActionButton className="mt-4" label={action} disabled={disabled} variant={completed ? 'secondary' : 'primary'} onPress={onOpen} /> : null}
    </SectionCard>
  );
}

export function TelematicsSetupOverview({ handover, disabled, onOpen }: {
  handover: MobileTelematicsHandover;
  disabled: boolean;
  onOpen: (view: TelematicsSetupView) => void;
}) {
  const overview = setupOverview(handover);
  const released = overview.release === 'released';
  const awaitingStaff = overview.release === 'awaiting_staff';
  const ReleaseIcon = released ? CheckCircle2 : awaitingStaff ? Clock3 : LockKeyhole;
  return (
    <View className="gap-4">
      <SetupStageCard
        title="Device setup" icon={Smartphone} progress={overview.device} disabled={disabled}
        lockedReason="Device setup is unavailable until handover is ready."
        action={overview.device.status === 'completed' ? 'Review checks' : overview.device.status === 'available' ? 'Begin setup' : 'Continue setup'}
        onOpen={() => onOpen('device_setup')}
      />
      <SetupStageCard
        title="Calibration" icon={Gauge} progress={overview.calibration} disabled={disabled}
        lockedReason={overview.device.passedCount < overview.device.total ? 'Complete device setup first.' : 'Calibration is unavailable until handover is ready.'}
        action={overview.calibration.status === 'available' ? 'Begin calibration' : 'Continue calibration'}
        onOpen={() => onOpen('calibration')}
      />
      <SectionCard title="Vehicle release" icon={KeyRound}>
        <View className="flex-row items-center gap-2">
          <ReleaseIcon size={18} color={released ? themeColors.success : themeColors.secondaryForeground} accessible={false} />
          <Text accessibilityLiveRegion="polite" className={`font-sans min-w-0 flex-1 text-body font-medium ${released ? 'text-success' : 'text-secondary-foreground'}`}>{released ? 'Released by staff' : awaitingStaff ? 'Awaiting staff release' : 'Awaiting setup'}</Text>
        </View>
        {overview.release === 'locked' ? <Text className="font-sans mt-3 text-body leading-6 text-secondary-foreground">Staff release the vehicle after setup.</Text> : released ? <ActionButton className="mt-4" label="Open rental" variant="primary" disabled={disabled} onPress={() => onOpen('rental')} /> : null}
      </SectionCard>
    </View>
  );
}
