import type { ObservationRevision } from './collection';
import type { ObservationInput } from '../../validation/research/collection';

export function observationFormValues(latest?: ObservationRevision): ObservationInput {
  return {
    base_revision: latest?.revision ?? 0,
    completed_as_planned: latest?.completed_as_planned ?? null,
    source: latest?.source ?? 'operator_report',
    observer_code: latest?.observer_code ?? null,
    flags: [...(latest?.flags ?? [])],
    actual_stop_method: latest?.actual_stop_method ?? 'unknown',
    notes: latest?.notes ?? null,
    ...(latest?.initial_deviation !== undefined ? { initial_deviation: latest.initial_deviation } : {}),
  };
}

export function observationSaveError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '';
  if (/access expired|access changed/i.test(message)) return 'Research access expired. Connect and verify access, then retry.';
  if (/Observations changed|revision limit|saved observations could not be confirmed/i.test(message)) return 'Reopen this recording to check its saved observations before retrying.';
  if (/another action is finishing/i.test(message)) return 'Another action is finishing. Try again.';
  return 'Could not save observations. Your original is kept. Try again.';
}
