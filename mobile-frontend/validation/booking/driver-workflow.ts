import { z } from 'zod';

export const driverWorkflowSchema = z.object({
  action: z.enum(['on_way', 'arrived', 'start_rental']),
});

export type DriverWorkflowInput = z.infer<typeof driverWorkflowSchema>;
