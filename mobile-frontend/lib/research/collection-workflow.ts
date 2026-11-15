export const TEST_VEHICLES = [
  { id: 'rc_pilot', label: 'RC Pilot' },
  { id: '4_seater', label: '4-seater vehicle' },
  { id: '7_seater', label: '7-seater vehicle' },
  { id: '12_plus_seater', label: '12+ seater vehicle' },
] as const;

export type TestVehicle = typeof TEST_VEHICLES[number]['id'];
export const VEHICLE_PREVIEW_STEPS = ['road', 'session', 'mount', 'review'] as const;
export type VehiclePreviewStep = typeof VEHICLE_PREVIEW_STEPS[number];

// The native collection contract remains RC-only. Preview choices never become
// recorder configuration or an implied supported real-vehicle profile.
export function canRecordTestVehicle(vehicle: unknown): vehicle is 'rc_pilot' {
  return vehicle === 'rc_pilot';
}

export function previousVehiclePreviewStep(step: VehiclePreviewStep): VehiclePreviewStep | null {
  const index = VEHICLE_PREVIEW_STEPS.indexOf(step);
  return index > 0 ? VEHICLE_PREVIEW_STEPS[index - 1] : null;
}
