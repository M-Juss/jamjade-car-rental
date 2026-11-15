import { z } from 'zod';

// Local UI preview only; this is not a native or Laravel write DTO.
export const vehicleSetupPreviewSchema = z.object({
  surface: z.string().trim().min(1, 'Select a road surface.').max(100),
  slope: z.enum(['level', 'uphill', 'downhill']),
  orientation: z.enum(['portrait', 'landscape']),
});

export type VehicleSetupPreviewInput = z.infer<typeof vehicleSetupPreviewSchema>;
