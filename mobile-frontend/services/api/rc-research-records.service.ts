import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { RcCaptureResult, RcResearchSession, RcResearchTrial } from '@/lib/research/rc-research';
import { apiDelete, apiGet, apiPost } from '@/services/http';
import type { RcSessionSetupInput, RcTrialReviewInput } from '@/validation/research/rc-research';

export async function createRcResearchSession(values: RcSessionSetupInput) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Research sessions require the Android or iOS app.');
  const { movement: _movement, intensity: _intensity, ...details } = values;
  const response = await apiPost<RcResearchSession>('/mobile/rc-research/sessions', {
    ...details, platform: Platform.OS, app_version: Constants.expoConfig?.version ?? 'unknown',
  });
  return response.data;
}

export async function saveRcResearchTrial(session: RcResearchSession, intended: Pick<RcSessionSetupInput, 'movement' | 'intensity'>,
  capture: RcCaptureResult, review: RcTrialReviewInput) {
  const samples = JSON.stringify(capture.samples);
  if (samples.length > session.protocol.max_samples_json_bytes) throw new Error('The recording is too large. Repeat the recording.');
  const body = new FormData();
  const values = { ...review, notes: review.notes ?? '', client_trial_id: capture.client_trial_id,
    protocol_version: session.protocol.version, intended_movement: intended.movement, intended_intensity: intended.intensity,
    started_at: capture.started_at, ended_at: capture.ended_at, samples_json: samples };
  for (const [key, value] of Object.entries(values)) body.append(key, String(value));
  const response = await apiPost<RcResearchTrial>(`/mobile/rc-research/sessions/${encodeURIComponent(session.id)}/trials`, body);
  return response.data;
}

export async function listRcResearchTrials(page = 1) {
  const response = await apiGet<RcResearchTrial[]>(`/mobile/rc-research/trials?page=${page}`);
  return { trials: response.data, page: Number(response.meta?.current_page ?? page), lastPage: Number(response.meta?.last_page ?? page) };
}

export async function deleteRcResearchTrial(id: string) {
  await apiDelete(`/mobile/rc-research/trials/${encodeURIComponent(id)}`);
}
