import { missingSetupPrerequisite, SETUP_CHECK_ORDER, type DeviceSetupStep } from '@/lib/telematics/setup';
import { getBookingTelematicsSetup, submitTelematicsSetupAttempt, type MobileTelematicsHandover, type TelematicsSetupAttemptEvidence } from '@/services/api';

import { getNetworkReadiness } from './network-readiness';
import { collectSetupReadiness } from './setup-readiness';

type SetupWorkflowCallbacks = {
  isActive: () => boolean;
  onStep: (step: DeviceSetupStep) => void;
  onUpdate: (handover: MobileTelematicsHandover) => void;
  confirmPhoneMount: () => Promise<boolean | null>;
};

export async function runSetupChecks(bookingCode: string, callbacks: SetupWorkflowCallbacks) {
  const failedChecks: string[] = [];

  for (const step of SETUP_CHECK_ORDER) {
    if (!callbacks.isActive()) return;
    callbacks.onStep(step);
    if (!await getNetworkReadiness()) throw new Error('You are offline. Connect to the internet and run setup again.');
    if (!callbacks.isActive()) return;
    const current = await getBookingTelematicsSetup(bookingCode);
    if (!callbacks.isActive()) return;
    callbacks.onUpdate(current);
    if (!current.eligibility.canWorkSetup) throw new Error('Setup is no longer available. Review the updated handover status.');
    if (missingSetupPrerequisite(current, step)) throw new Error('An earlier required check has not passed. Run setup again after resolving it.');

    const mounted = step === 'phone_mount' ? await callbacks.confirmPhoneMount() : undefined;
    if (!callbacks.isActive()) return;
    if (mounted === null) return { failed: false, message: 'Setup paused before phone-mount confirmation. Tap Check setup when you are ready.' };

    let evidence: TelematicsSetupAttemptEvidence;
    try {
      evidence = await collectSetupReadiness(step, mounted);
    } catch (error) {
      if (!callbacks.isActive()) return;
      // The existing local test mode allows release with real failed checks.
      // A native failure with no evidence is never submitted as a fake result.
      if (!current.eligibility.testMode) throw error;
      failedChecks.push(current.steps.find((item) => item.type === step)?.label ?? step);
      continue;
    }
    if (!callbacks.isActive()) return;
    const updated = await submitTelematicsSetupAttempt(bookingCode, step, evidence);
    if (!callbacks.isActive()) return;
    callbacks.onUpdate(updated);
    const result = updated.steps.find((item) => item.type === step);
    if (result?.status !== 'passed') {
      const message = result?.failureReason ?? 'The setup check did not pass. Review the result and run setup again.';
      if (!updated.eligibility.testMode || step === 'phone_mount') return { failed: true, message };
      failedChecks.push(result?.label ?? step);
    }
  }

  return failedChecks.length
    ? { failed: true, message: `Test setup finished with checks needing attention: ${failedChecks.join(', ')}. Phone mount is confirmed; staff can test release.` }
    : { failed: false, message: 'All six available setup checks passed. Phone mount is confirmed. Review the handover status for the next step.' };
}
