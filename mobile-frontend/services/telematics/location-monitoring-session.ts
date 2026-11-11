import type { LocationMonitoringSnapshot, LocationMonitoringStart } from '../api/location-monitoring.service';
import type { ForegroundLocationReading } from './foreground-location';
import { latestLocationSchema, locationConsentSchema, type LatestLocationFix, type LocationConsentInput, type LocationMonitoringPolicy } from '../../validation/telematics/location-monitoring';

export type LocationSharingPhase = 'idle' | 'starting' | 'waiting' | 'sharing' | 'paused' | 'offline' | 'error';
export type LocationSharingState = {
  bookingCode: string | null;
  phase: LocationSharingPhase;
  message: string | null;
  accuracy: number | null;
  lastUploadedAt: string | null;
  needsSettings: boolean;
  backgroundEnabled: boolean;
  latestFix: LatestLocationFix | null;
};
export const isLocationSharingActive = (phase: LocationSharingPhase) => ['starting', 'waiting', 'sharing'].includes(phase);

export type LocationMonitoringDependencies = {
  read: (code: string, signal: AbortSignal) => Promise<LocationMonitoringSnapshot>;
  start: (code: string, fix: LatestLocationFix, consent: LocationConsentInput, policy: LocationMonitoringPolicy, signal: AbortSignal) => Promise<LocationMonitoringStart>;
  update: (code: string, fix: LatestLocationFix, token: string, policy: LocationMonitoringPolicy, signal: AbortSignal) => Promise<LocationMonitoringSnapshot>;
  pause: (code: string, token: string, signal: AbortSignal, reason?: 'manual' | 'interrupted') => Promise<unknown>;
  prepare: (isActive: () => boolean, mode: LocationConsentInput['sharing_mode']) => Promise<void>;
  watch: (interval: number, onReading: (reading: ForegroundLocationReading) => Promise<void>, onError: () => Promise<void>, mode: LocationConsentInput['sharing_mode']) => Promise<{ remove: () => void }>;
  cleanup?: () => Promise<void>;
  connected: () => Promise<boolean>;
  foreground: () => boolean;
  now: () => number;
};

const emptyState: LocationSharingState = { bookingCode: null, phase: 'idle', message: null, accuracy: null, lastUploadedAt: null, needsSettings: false, backgroundEnabled: false, latestFix: null };

export class LocationMonitoringIssue extends Error {
  constructor(message: string, readonly needsSettings = false) { super(message); }
}

function sharingFailure(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  if ('status' in error && [401, 403, 404].includes(Number(error.status))) return 'This rental is no longer available for sharing. Refresh or sign in again.';
  const fields = 'errors' in error && error.errors && typeof error.errors === 'object' ? error.errors : null;
  if (!fields) return fallback;
  if ('consent' in fields || 'consent_version' in fields) return 'Location sharing terms changed. Refresh and agree again.';
  if ('captured_at' in fields) return 'A fresh GPS reading is required. Check automatic date and time, then try again.';
  if ('accuracy' in fields || 'latitude' in fields || 'longitude' in fields) return 'An accurate GPS reading is required. Move to a clearer area and try again.';
  if ('session_token' in fields) return 'The sharing session changed. Tap Resume sharing to start again.';
  if ('monitoring' in fields) return 'Location sharing is unavailable for this rental. Refresh its status.';
  return fallback;
}

// One ephemeral session and at most one pending point, shared by native callbacks and UI.
export class LocationMonitoringSession {
  private state: LocationSharingState = emptyState;
  private listeners = new Set<() => void>();
  private generation = 0;
  private watch: { remove: () => void } | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private request: AbortController | null = null;
  private token: string | null = null;
  private pending: LatestLocationFix | null = null;
  private policy: LocationMonitoringPolicy | null = null;
  private consent: LocationConsentInput | null = null;
  private busy = false;
  private lastChecked = 0;
  private lastSent = 0;
  private lastFix = 0;
  private started = 0;
  private readingValid = false;

  constructor(private dependencies: LocationMonitoringDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  canContinueInBackground = () => this.state.backgroundEnabled && isLocationSharingActive(this.state.phase);

  async check() {
    await this.pump(this.generation);
  }

  connectionRestored(bookingCode: string) {
    if (this.state.bookingCode === bookingCode && this.state.phase === 'offline') {
      this.emit({ phase: 'paused', message: null });
    }
  }

  private emit(patch: Partial<LocationSharingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  stop(message = 'Location sharing is paused.', phase: LocationSharingPhase = 'paused', needsSettings = false, reason: 'manual' | 'interrupted' = 'manual') {
    const code = this.state.bookingCode;
    const token = this.token;
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.watch?.remove();
    this.watch = null;
    clearInterval(this.timer);
    this.timer = undefined;
    this.token = null;
    this.pending = null;
    this.consent = null;
    this.busy = false;
    this.emit({ phase, message, accuracy: null, needsSettings, backgroundEnabled: false, latestFix: null });
    const stoppedGeneration = this.generation;
    const cleanup = this.dependencies.cleanup?.().catch(() => {
      if (this.generation === stoppedGeneration) this.emit({ message: 'Sharing stopped sending. Close JamJade if its location indicator remains.' });
    });
    if (code && token) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      void this.dependencies.pause(code, token, controller.signal, phase === 'error' || phase === 'offline' ? 'interrupted' : reason).catch(() => {}).finally(() => clearTimeout(timeout));
    }
    return cleanup ?? Promise.resolve();
  }

  reset() {
    const cleanup = this.stop();
    this.state = emptyState;
    this.listeners.forEach((listener) => listener());
    return cleanup;
  }

  async start(code: string, values: LocationConsentInput) {
    const consent = locationConsentSchema.parse(values);
    const cleanup = this.stop();
    const generation = this.generation;
    await cleanup;
    if (generation !== this.generation) return;
    const active = () => generation === this.generation && (this.dependencies.foreground() || this.canContinueInBackground());
    this.emit({ ...emptyState, bookingCode: code, phase: 'starting' });
    this.started = this.dependencies.now();
    this.lastSent = 0;
    this.lastFix = 0;
    this.readingValid = false;
    try {
      if (!active()) { await this.stop('Return to the app and start sharing again.'); return; }
      if (!await this.dependencies.connected()) { if (active()) await this.stop('Connect to the internet, then resume sharing.', 'offline'); return; }
      if (!active()) return;
      const snapshot = await this.withRequest((signal) => this.dependencies.read(code, signal));
      if (!active()) return;
      if (!snapshot.canMonitor || consent.consent_version !== snapshot.policy.consentVersion) throw new LocationMonitoringIssue('Location sharing is unavailable. Refresh the rental and try again.');
      this.policy = snapshot.policy;
      this.consent = consent;
      this.lastChecked = this.dependencies.now();
      await this.dependencies.prepare(active, consent.sharing_mode);
      if (!active()) return;
      this.emit({ phase: 'waiting', message: 'Waiting for an accurate GPS reading.' });
      const subscription = await this.dependencies.watch(snapshot.policy.uploadIntervalSeconds, async (reading) => {
        if (!active()) return;
        this.reading(reading);
        await this.pump(generation);
      }, async () => { if (active()) await this.stop('GPS updates stopped. Check location access and try again.', 'error'); }, consent.sharing_mode);
      if (!active()) { subscription.remove(); return; }
      this.watch = subscription;
      this.emit({ backgroundEnabled: consent.sharing_mode === 'foreground_background' });
      this.timer = setInterval(() => { void this.pump(generation); }, 1000);
    } catch (error) {
      if (active()) await this.stop(error instanceof LocationMonitoringIssue
        ? error.message : sharingFailure(error, 'Location sharing could not start. Check your connection and try again.'), 'error', error instanceof LocationMonitoringIssue && error.needsSettings);
    }
  }

  private reading(reading: ForegroundLocationReading) {
    if (!this.policy) return;
    const parsed = latestLocationSchema(this.policy).safeParse(reading);
    const age = this.dependencies.now() - Date.parse(reading.captured_at);
    if (!parsed.success || Date.parse(reading.captured_at) < this.started || age < -this.policy.futureSkewSeconds * 1000 || age > this.policy.maximumAgeSeconds * 1000) {
      this.readingValid = false;
      this.pending = null;
      this.emit({ phase: 'waiting', latestFix: null, accuracy: typeof reading.accuracy === 'number' && Number.isFinite(reading.accuracy) && reading.accuracy >= 0 ? reading.accuracy : null, message: 'Waiting for a fresh, accurate GPS reading. Move to a clearer area.' });
      return;
    }
    this.readingValid = true;
    this.lastFix = Math.min(Date.parse(parsed.data.captured_at), this.dependencies.now());
    if (!this.pending || Date.parse(parsed.data.captured_at) > Date.parse(this.pending.captured_at)) this.pending = parsed.data;
    this.emit({ accuracy: parsed.data.accuracy, latestFix: parsed.data });
  }

  private async withRequest<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.request = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try { return await action(controller.signal); }
    finally { clearTimeout(timeout); if (this.request === controller) this.request = null; }
  }

  private async pump(generation: number) {
    const active = () => generation === this.generation && (this.dependencies.foreground() || this.canContinueInBackground()) && isLocationSharingActive(this.state.phase);
    if (!active() || this.busy || !this.policy || !this.consent || !this.state.bookingCode) return;
    const now = this.dependencies.now();
    if ((!this.lastFix && now - this.started >= 30_000) || (this.lastFix && now - this.lastFix > this.policy.maximumAgeSeconds * 1000)) {
      await this.stop('GPS readings were interrupted. Move to a clearer area and resume sharing.', 'error');
      return;
    }
    const checkDue = now - this.lastChecked >= 15_000;
    const sendDue = this.pending && (!this.token || now - this.lastSent >= this.policy.uploadIntervalSeconds * 1000);
    if (!checkDue && !sendDue) return;
    this.busy = true;
    const code = this.state.bookingCode;
    try {
      if (!await this.dependencies.connected()) { if (active()) await this.stop('Connection lost. Reconnect, then resume sharing.', 'offline'); return; }
      if (!active()) return;
      if (checkDue) {
        const snapshot = await this.withRequest((signal) => this.dependencies.read(code, signal));
        if (!active()) return;
        this.lastChecked = this.dependencies.now();
        if (!snapshot.canMonitor || snapshot.policy.consentVersion !== this.consent.consent_version || (this.token && snapshot.tripStatus !== 'started')) {
          await this.stop('This rental is no longer available for sharing. Refresh its status.');
          return;
        }
        this.policy = snapshot.policy;
      }
      const fix = this.pending;
      if (!fix || !sendDue) return;
      this.pending = null;
      const age = this.dependencies.now() - Date.parse(fix.captured_at);
      if (age > this.policy.maximumAgeSeconds * 1000) return;
      const beginning = !this.token;
      const result = this.token
        ? await this.withRequest((signal) => this.dependencies.update(code, fix, this.token!, this.policy!, signal))
        : await this.withRequest((signal) => this.dependencies.start(code, fix, this.consent!, this.policy!, signal));
      if (!active()) return;
      if (beginning) {
        if (!('sessionToken' in result) || typeof result.sessionToken !== 'string' || result.sessionToken.length !== 64) throw new Error('Missing sharing session.');
        this.token = result.sessionToken;
      }
      this.lastSent = this.dependencies.now();
      this.emit({ ...(this.readingValid ? { phase: 'sharing' as const, message: null } : {}), lastUploadedAt: result.lastLocationAt });
    } catch (error) {
      if (active()) await this.stop(sharingFailure(error, 'Location sharing was interrupted. Check your connection and resume sharing.'), 'error');
    } finally { if (generation === this.generation) this.busy = false; }
  }
}
