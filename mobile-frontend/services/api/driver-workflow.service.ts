import { apiPost } from '@/services/http';
import { driverWorkflowSchema, type DriverWorkflowInput } from '@/validation/booking/driver-workflow';
import { mapBooking } from './booking.service';
import type { MobileBookingRecord } from './types';

export async function updateDriverWorkflow(bookingId: number, payload: DriverWorkflowInput) {
  const values = driverWorkflowSchema.parse(payload);
  return mapBooking((await apiPost<MobileBookingRecord>(`/mobile/driver/services/${bookingId}/workflow`, values)).data);
}
