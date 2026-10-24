import { DeviceMotion } from 'expo-sensors';
import { AppState, Platform } from 'react-native';

import { CalibrationAccumulator, rotationAxes, type Vector3 } from '@/lib/telematics/calibration';
import type { RcCaptureResult, RcLiveReading, RcProtocol, RcSample, RcSummary } from '@/lib/research/rc-research';

export class RcResearchCaptureError extends Error {}

let collecting = false;

export async function captureRcResearch(protocol: RcProtocol, cancel: AbortSignal, stop: AbortSignal,
  onReading: (reading: RcLiveReading) => void): Promise<RcCaptureResult> {
  if (Platform.OS !== 'android') throw new RcResearchCaptureError('Motion recording requires the Android app.');
  if (collecting) throw new RcResearchCaptureError('Another motion recording is already running.');
  if (protocol.version !== 1 || protocol.recording_mode !== 'manual' || protocol.requested_interval_ms !== 20)
    throw new RcResearchCaptureError('Refresh the research session before recording.');
  if (cancel.aborted || stop.aborted || AppState.currentState !== 'active') throw new RcResearchCaptureError('Keep the app open and start again.');
  collecting = true;
  try {
    if (!await DeviceMotion.isAvailableAsync()) throw new RcResearchCaptureError('Motion sensors are unavailable on this phone.');
    let permission = await DeviceMotion.getPermissionsAsync();
    if (!permission.granted) permission = await DeviceMotion.requestPermissionsAsync();
    if (!permission.granted) throw new RcResearchCaptureError('Allow motion access in device settings before recording.');
    if (cancel.aborted || stop.aborted || AppState.currentState !== 'active') throw new RcResearchCaptureError('Recording stopped. Keep the app open and start again.');
    return await new Promise<RcCaptureResult>((resolve, reject) => {
      const accumulator = new CalibrationAccumulator(null, undefined, protocol.max_samples);
      const samples: RcSample[] = [];
      let started: number | null = null, startedAt = '', previous: { timestamp: number; arrival: number } | null = null;
      let steadySince = 0, lastFeedback = -Infinity, finished = false, sampleBytes = 2;
      let sensor: ReturnType<typeof DeviceMotion.addListener> | undefined;
      let app: ReturnType<typeof AppState.addEventListener> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const summary = (elapsed: number): RcSummary => {
        const value = accumulator.summary(elapsed);
        const rate = value.sensor_duration_ms > 0 ? (value.sample_count - 1) * 1000 / value.sensor_duration_ms : 0;
        return { sample_count: value.sample_count, duration_ms: elapsed, sensor_duration_ms: value.sensor_duration_ms,
          mean_rate_hz: rate, max_gap_ms: value.max_gap_ms, linear_rms: value.linear_rms,
          rotation_rms: value.rotation_rms, rotation_peak: value.rotation_peak, max_tilt_degrees: value.max_tilt_degrees,
          linear_mean: [value.linear_mean_x, value.linear_mean_y, value.linear_mean_z],
          rotation_mean: [value.rotation_mean_x, value.rotation_mean_y, value.rotation_mean_z],
          gravity_mean: [value.gravity_x, value.gravity_y, value.gravity_z],
          quality_flags: [rate < 8 ? 'low_sample_rate' : '', value.max_gap_ms > 250 ? 'sample_gaps' : '',
            value.sensor_duration_ms / elapsed < 0.85 ? 'limited_coverage' : ''].filter(Boolean) };
      };
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer); clearInterval(heartbeat); sensor?.remove(); app?.remove();
        cancel.removeEventListener('abort', cancelled); stop.removeEventListener('abort', stopped);
        if (error) { reject(error); return; }
        const elapsed = started === null ? 0 : performance.now() - started;
        if (elapsed < protocol.minimum_duration_ms || samples.length < 8) {
          reject(new RcResearchCaptureError('Record for at least one second with active motion readings, then try again.')); return;
        }
        const endedAt = new Date().toISOString();
        const wallDuration = Date.parse(endedAt) - Date.parse(startedAt);
        if (wallDuration < 1000 || wallDuration > 86400000) { reject(new RcResearchCaptureError('Recording time changed unexpectedly. Repeat the recording.')); return; }
        resolve({ client_trial_id: `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`,
          started_at: startedAt, ended_at: endedAt, samples, summary: summary(wallDuration) });
      };
      const cancelled = () => finish(new RcResearchCaptureError('Recording stopped. Keep the app open and start again.'));
      const stopped = () => finish();
      cancel.addEventListener('abort', cancelled, { once: true });
      stop.addEventListener('abort', stopped, { once: true });
      app = AppState.addEventListener('change', state => { if (state !== 'active') cancelled(); });
      try {
        onReading({ phase: 'preparing' });
        DeviceMotion.setUpdateInterval(protocol.requested_interval_ms);
        timer = setTimeout(() => finish(new RcResearchCaptureError('Fresh motion readings were not received. Try again.')), 3000);
        sensor = DeviceMotion.addListener(measurement => {
          if (finished) return;
          const { acceleration: acceleration, accelerationIncludingGravity: including, rotationRate: rotation } = measurement;
          if (!acceleration || !including || !rotation) return;
          const values = [acceleration.timestamp, including.timestamp, rotation.timestamp, acceleration.x, acceleration.y, acceleration.z,
            including.x, including.y, including.z, rotation.alpha, rotation.beta, rotation.gamma];
          if (!values.every(Number.isFinite) || Math.abs(acceleration.timestamp - including.timestamp) > 0.1 || Math.abs(acceleration.timestamp - rotation.timestamp) > 0.1) return;
          const gravity: Vector3 = [including.x - acceleration.x, including.y - acceleration.y, including.z - acceleration.z];
          if (Math.hypot(...gravity) < 1) return;
          const arrival = performance.now();
          if (started === null) {
            const sensorDelta = previous ? (acceleration.timestamp - previous.timestamp) * 1000 : 0;
            const arrivalDelta = previous ? arrival - previous.arrival : 0;
            if (!previous || sensorDelta <= 0 || sensorDelta > 250 || arrivalDelta > 250 || Math.abs(sensorDelta - arrivalDelta) > 100) steadySince = arrival;
            previous = { timestamp: acceleration.timestamp, arrival };
            if (arrival - steadySince < 200) return;
            started = arrival; startedAt = new Date().toISOString();
            clearTimeout(timer); timer = undefined;
            heartbeat = setInterval(() => {
              if (finished || started === null || !samples.length) return;
              onReading({ phase: 'recording', summary: summary(performance.now() - started), sample: samples.at(-1),
                capacity_used: Math.max(samples.length / protocol.max_samples, sampleBytes / protocol.max_samples_json_bytes) });
            }, 200);
          }
          const last = samples.at(-1);
          if (last && acceleration.timestamp <= last.acceleration_timestamp_s) return;
          if (samples.length >= protocol.max_samples) { finish(new RcResearchCaptureError('The recording reached its data limit. Start a shorter trial.')); return; }
          const axes = rotationAxes(rotation);
          const sample: RcSample = { elapsed_ms: arrival - started, acceleration_timestamp_s: acceleration.timestamp,
            gravity_timestamp_s: including.timestamp, rotation_timestamp_s: rotation.timestamp,
            linear_x: acceleration.x, linear_y: acceleration.y, linear_z: acceleration.z,
            including_gravity_x: including.x, including_gravity_y: including.y, including_gravity_z: including.z,
            rotation_x: axes[0], rotation_y: axes[1], rotation_z: axes[2], orientation: measurement.orientation };
          const bytes = JSON.stringify(sample).length + 1;
          if (sampleBytes + bytes > protocol.max_samples_json_bytes) { finish(new RcResearchCaptureError('The recording reached its data limit. Start a shorter trial.')); return; }
          sampleBytes += bytes;
          try {
            accumulator.add([acceleration.x, acceleration.y, acceleration.z], gravity, axes, acceleration.timestamp, sample.elapsed_ms);
            samples.push(sample);
            if (arrival - lastFeedback >= 200) {
              lastFeedback = arrival; onReading({ phase: 'recording', summary: summary(sample.elapsed_ms), sample,
                capacity_used: Math.max(samples.length / protocol.max_samples, sampleBytes / protocol.max_samples_json_bytes) });
            }
          } catch { finish(new RcResearchCaptureError('Motion readings could not be processed. Repeat the recording.')); }
        });
      } catch { finish(new RcResearchCaptureError('Motion recording could not start. Check motion access and try again.')); }
    });
  } finally { collecting = false; }
}
