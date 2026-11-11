import type { LocationConsentInput } from '../../validation/telematics/location-monitoring';

export type ReleaseMonitoringContext = {
  userId: number;
  bookingCode: string;
  startedAt: string | null;
  profile: string | null;
};

// A one-use, in-memory instruction. It never survives leaving this screen or
// runtime loss, and it cannot restart monitoring after Stop or an interruption.
export class ReleaseMonitoringPreparation {
  private prepared: { context: ReleaseMonitoringContext; consent: LocationConsentInput; includeMotion: boolean } | null = null;

  arm(context: ReleaseMonitoringContext, consent: LocationConsentInput, includeMotion = false) {
    this.prepared = { context: { ...context }, consent: { ...consent }, includeMotion };
  }

  clear() { this.prepared = null; }

  matches(context: ReleaseMonitoringContext) {
    const saved = this.prepared?.context;
    return Boolean(saved && saved.userId === context.userId && saved.bookingCode === context.bookingCode
      && saved.startedAt === context.startedAt && saved.profile === context.profile);
  }

  take(context: ReleaseMonitoringContext, released: boolean, canMonitor: boolean, foreground: boolean, consentVersion: number) {
    if (!this.matches(context) || this.prepared?.consent.consent_version !== consentVersion) {
      this.clear();
      return null;
    }
    if (!released || !canMonitor || !foreground) return null;
    const { consent, includeMotion } = this.prepared!;
    this.clear();
    return { consent, includeMotion };
  }
}
