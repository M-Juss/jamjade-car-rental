import { isCalibrationStep, type CalibrationLiveState } from '@/lib/telematics/calibration';
import { getBookingTelematicsSetup, submitTelematicsSetupAttempt, type MobileTelematicsHandover } from '@/services/api';
import { calibrationConsentSchema, calibrationEvidenceSchema, type CalibrationConsentInput } from '@/validation/telematics/calibration';

import { getNetworkReadiness } from './network-readiness';
import { captureRentalMotion } from './rental-motion-capture';

export async function runCalibrationCheck(
  bookingCode: string,
  consent: CalibrationConsentInput,
  signal: AbortSignal,
  onUpdate: (handover: MobileTelematicsHandover) => void,
  onRecording: (recording: boolean) => void,
  expectedStep: string | null,
  expectedProfileFingerprint: string | null,
  restart = false,
  onLive?: (state: CalibrationLiveState) => void,
) {
  calibrationConsentSchema.parse(consent);
  if (!await getNetworkReadiness()) throw new Error('You are offline. Connect to the internet before starting calibration.');
  if (signal.aborted) return;
  const current = await getBookingTelematicsSetup(bookingCode);
  if (signal.aborted) return;
  onUpdate(current);
  const { context, reference, protocolVersion } = current.calibration;
  const nextStep = restart && current.calibration.nextStep ? 'stationary_calibration' : current.calibration.nextStep;
  if (protocolVersion !== 4) throw new Error('Refresh JamJade before starting calibration.');
  if (!expectedProfileFingerprint || current.calibration.profile.fingerprint !== expectedProfileFingerprint) throw new Error('Calibration settings changed. Reopen calibration before recording again.');
  if (!current.eligibility.canWorkSetup || !isCalibrationStep(nextStep) || !context) throw new Error('Calibration is no longer available. Review the updated handover status.');
  if (!restart && nextStep !== expectedStep) throw new Error('The calibration step changed. Review the updated instructions before recording.');
  if (nextStep !== 'stationary_calibration' && !reference) throw new Error('Repeat stationary calibration to restore the phone’s reference position.');
  if (nextStep === 'stationary_calibration' && !current.calibration.stationaryLimits) throw new Error('Calibration settings could not be loaded. Refresh and try again.');
  if (nextStep === 'forward_calibration' && (!current.calibration.noiseBaseline || !current.calibration.forwardLimits)) throw new Error('Repeat stationary calibration to measure parked vibration.');
  onLive?.({ step: nextStep, phase: 'preparing' });
  let capture: Awaited<ReturnType<typeof captureRentalMotion>>;
  try {
    capture = await captureRentalMotion(nextStep, current.calibration, signal,
      () => { if (!signal.aborted) onRecording(true); },
      (reading) => { if (!signal.aborted) onLive?.({ step: nextStep, phase: 'recording', reading }); },
    );
  }
  finally { onRecording(false); }
  if (signal.aborted) return;
  onLive?.({ step: nextStep, phase: 'evaluating' });
  const evidence = calibrationEvidenceSchema.safeParse({
    ...capture, protocol_version: protocolVersion, context, consent: consent.consent, supervised: consent.supervised,
  });
  if (!evidence.success) throw new Error('Motion readings could not be evaluated. Park safely and repeat this calibration step.');
  if (!await getNetworkReadiness()) throw new Error('The recording could not be saved while offline. Reconnect, park safely and repeat this step.');
  if (signal.aborted) return;
  const updated = await submitTelematicsSetupAttempt(bookingCode, nextStep, evidence.data);
  if (signal.aborted) return;
  onUpdate(updated);
  const result = updated.steps.find((step) => step.type === nextStep);
  onLive?.({ step: nextStep, phase: result?.status === 'passed' ? 'passed' : 'failed' });
  return result?.status === 'passed'
    ? { failed: false, message: updated.setup?.status === 'ready_for_release' ? 'Calibration complete. Wait for staff to release the vehicle.' : 'Step passed. Park safely before continuing.' }
    : { failed: true, message: result?.failureReason ?? 'The step did not pass. Park safely before trying again.' };
}
