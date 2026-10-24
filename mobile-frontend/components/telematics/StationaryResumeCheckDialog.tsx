import { Alert, Linking, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import type { useStationaryResumeCheck } from '@/hooks/telematics/useStationaryResumeCheck';
import type { StationaryResumeSettings } from '@/lib/telematics/stationary-resume';
import { StationaryCalibration } from './StationaryCalibration';
import { TelematicsStageDialog } from './TelematicsStageDialog';

export function StationaryResumeCheckDialog({ check, initialSettings }: {
  check: ReturnType<typeof useStationaryResumeCheck>; initialSettings?: StationaryResumeSettings;
}) {
  const settings = check.settings ?? initialSettings;
  const passed = check.live?.phase === 'passed';
  return <TelematicsStageDialog title="Stationary check" visible={check.visible} busy={check.busy} compact animationType="none" onClose={check.close}
    footer={check.busy ? <ActionButton label="Cancel check" onPress={check.close} />
      : passed ? <ActionButton label="Resume monitoring" variant="primary" onPress={check.resume} />
        : <View className="gap-3">
          {check.needsSettings ? <ActionButton label="Open device settings" onPress={() => void Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open device Settings to allow motion access.'))} /> : null}
          <ActionButton label={check.error ? 'Retry check' : 'Start check'} variant="primary" disabled={!settings} onPress={() => void check.run()} />
        </View>}>
    <Text className="font-sans text-caption leading-5 text-secondary-foreground">A short motion check runs on this phone. Readings are discarded afterward.</Text>
    {settings ? <StationaryCalibration purpose="resume" live={check.live} limits={settings.stationaryLimits}
      durationSeconds={settings.captureSeconds.stationary_calibration} rcDemo={settings.profile.id === 'rc_demo'} busy={check.busy} failureReason={check.error}>
      {null}
    </StationaryCalibration> : <Text className="font-sans text-body text-secondary-foreground">Refresh the rental to load this check.</Text>}
  </TelematicsStageDialog>;
}
