import { ActivityIndicator, Text, View } from 'react-native';
import { useState } from 'react';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { StationaryCalibration } from '@/components/telematics/StationaryCalibration';
import { ForwardCalibration } from '@/components/telematics/ForwardCalibration';
import { RcMovementCalibration } from '@/components/telematics/RcMovementCalibration';
import { CalibrationSuccess } from '@/components/telematics/CalibrationSuccess';
import { CalibrationRecordingForm } from '@/forms/telematics/CalibrationRecordingForm';
import { CALIBRATION_STEPS, isCalibrationStep, type CalibrationLiveState } from '@/lib/telematics/calibration';
import { CALIBRATION_CHECK_ORDER } from '@/lib/telematics/setup';
import type { MobileTelematicsHandover } from '@/services/api';
import type { CalibrationConsentInput } from '@/validation/telematics/calibration';

export function TelematicsCalibration({ handover, consent, busy, recording, live, onDismissSuccess, onStart, onCancel }: {
  handover: MobileTelematicsHandover;
  consent: CalibrationConsentInput;
  busy: boolean;
  recording: boolean;
  live: CalibrationLiveState | null;
  onDismissSuccess: () => void;
  onStart: (values: CalibrationConsentInput, restart: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [restarting, setRestarting] = useState(false);
  const rcDemo = handover.calibration.profile.id === 'rc_demo';
  const showSuccess = live?.phase === 'passed';
  const next = restarting ? 'stationary_calibration'
    : live && live.phase !== 'failed' ? live.step : handover.calibration.nextStep;
  const type = isCalibrationStep(next) ? next : null;
  const preparing = live?.step === type && live.phase === 'preparing';
  const evaluating = live?.step === type && live.phase === 'evaluating';
  const pending = preparing || evaluating;
  const definition = type ? CALIBRATION_STEPS[type] : null;
  const result = handover.steps.find((step) => step.type === type);
  if (showSuccess) return <CalibrationSuccess key={live.step} step={live.step}
    nextStep={isCalibrationStep(handover.calibration.nextStep) ? handover.calibration.nextStep : null}
    ready={!busy} onComplete={onDismissSuccess} />;

  if (type === 'stationary_calibration' && handover.calibration.stationaryLimits) return (
    <StationaryCalibration live={live?.step === type ? live : null} limits={handover.calibration.stationaryLimits}
      rcDemo={handover.calibration.profile.id === 'rc_demo'}
      durationSeconds={handover.calibration.captureSeconds[type]} busy={busy} failureReason={result?.failureReason}>
      <CalibrationRecordingForm consent={consent} key={`${handover.bookingCode}:${handover.calibration.context}:${restarting}`} disabled={busy || !handover.eligibility.canWorkSetup} onStart={async (values) => { await onStart(values, restarting); setRestarting(false); }} />
    </StationaryCalibration>
  );
  if (rcDemo && type && type !== 'stationary_calibration') return (
    <RcMovementCalibration step={type} live={live?.step === type ? live : null} calibration={handover.calibration} busy={busy} failureReason={result?.failureReason}>
      <CalibrationRecordingForm consent={consent} key={`${handover.bookingCode}:${handover.calibration.context}`} disabled={busy || !handover.eligibility.canWorkSetup} onStart={async (values) => { await onStart(values, false); }} />
      <ActionButton label="Restart calibration" disabled={busy} onPress={() => setRestarting(true)} />
    </RcMovementCalibration>
  );
  if (type === 'forward_calibration' && handover.calibration.forwardLimits) return (
    <ForwardCalibration live={live?.step === type ? live : null} limits={handover.calibration.forwardLimits} mountLimits={handover.calibration.stationaryLimits} movementLimits={handover.calibration.movementLimits} noiseBaseline={handover.calibration.noiseBaseline}
      busy={busy} failureReason={result?.failureReason}>
      <CalibrationRecordingForm consent={consent} key={`${handover.bookingCode}:${handover.calibration.context}`} disabled={busy || !handover.eligibility.canWorkSetup} onStart={async (values) => { await onStart(values, false); }} />
      <ActionButton label="Restart calibration" disabled={busy} onPress={() => setRestarting(true)} />
    </ForwardCalibration>
  );
  return (
    <View>
      <Text className="font-sans text-caption text-secondary-foreground">Step {type ? CALIBRATION_CHECK_ORDER.indexOf(type) + 1 : 1} of {CALIBRATION_CHECK_ORDER.length}</Text>
      <Text accessibilityLiveRegion="polite" className="font-sans mt-3 text-section font-semibold text-foreground">{preparing ? 'Preparing sensors' : evaluating ? 'Checking recording' : recording ? 'Recording motion' : definition?.title ?? 'Refresh setup to continue'}</Text>
      <Text className="font-sans mt-2 text-body leading-6 text-secondary-foreground">{preparing ? 'Keep parked. Wait for Recording motion before moving.' : evaluating ? 'Recording finished. Keep parked while the result is checked.' : recording ? 'Keep the phone mounted and untouched. Follow staff directions and stop safely. Recording ends when the movement is captured.' : definition?.guidance}</Text>
      {recording || pending ? (
        <View className="mt-section gap-4">
          <ActivityIndicator color={themeColors.primary} size="large" />
          {!evaluating ? <ActionButton label={preparing ? 'Cancel' : 'Stop recording'} onPress={onCancel} /> : null}
        </View>
      ) : null}
      <View className="mt-4 gap-4" style={{ display: recording || pending ? 'none' : 'flex' }}>
          <Text className="font-sans text-caption leading-5 text-secondary-foreground">{type === 'stationary_calibration' ? 'Keep the vehicle parked and leave the phone untouched.' : 'Recording ends when the movement is captured. Leave the mounted phone untouched and stop safely.'}</Text>
          {result?.failureReason ? <Text className="font-sans text-body leading-6 text-destructive">{result.failureReason}</Text> : null}
          <CalibrationRecordingForm consent={consent} key={`${handover.bookingCode}:${handover.calibration.context}:${restarting}`} disabled={busy || !type || !handover.eligibility.canWorkSetup} onStart={async (values) => { await onStart(values, restarting); setRestarting(false); }} />
          {type && type !== 'stationary_calibration' ? <ActionButton label="Restart calibration" disabled={busy} onPress={() => setRestarting(true)} /> : null}
      </View>
    </View>
  );
}
