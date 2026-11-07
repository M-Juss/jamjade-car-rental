import type { NativeEvent } from '@/services/research/native-types';
import type { ReferenceRange } from './forward-reference';
import { suggestForwardIntervals } from './reference-suggestions';

export const FSS_TIMING_VERSION = 'fss-intervals-v2';
export type TimingSuggestion = { id: string; range: ReferenceRange };

/** Experimental timing proposals only. No movement/direction/severity is inferred. */
export function suggestFssIntervals(protocol: string | undefined, acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string,
  bounds: ReferenceRange, duration: number) {
  if (protocol !== 'FSS') return { available: false as const, reason: 'Timing suggestions are available for FSS only.' };
  if (bounds[0] !== 0 || bounds[1] !== duration || duration > 30000) {
    return { available: false as const, reason: 'Load the complete FSS recording, up to 30 seconds. Otherwise select intervals manually.' };
  }
  const result = suggestForwardIntervals(acceleration, gyroscope, origin, bounds, 250);
  if (!result.available) return result;
  const { rest, starting, stopping } = result.ranges;
  const ranges: ReferenceRange[] = [rest, starting];
  // This span is merely between two signal transitions, not evidence of steady driving.
  if (stopping[0] - starting[1] >= 500) ranges.push([starting[1], stopping[0]]);
  ranges.push(stopping);
  if (result.quietAfter) ranges.push(result.quietAfter);
  return { available: true as const, intervals: ranges.map((range, index): TimingSuggestion => ({ id: `${FSS_TIMING_VERSION}-${index}`, range: [...range] })),
    notes: result.notes };
}

export function overlapsLabel(range: ReferenceRange, items: { start_ms: number; end_ms: number }[]) {
  return items.some(item => range[0] < item.end_ms && range[1] > item.start_ms);
}
