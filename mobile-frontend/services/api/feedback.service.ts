import { apiPost } from '@/services/http';
import type { BookingFeedback } from '@/types/booking';
import { bookingFeedbackSchema, type BookingFeedbackInput } from '@/validation/booking/feedback';

export async function submitBookingFeedback(bookingId: number, input: BookingFeedbackInput) {
  const values = bookingFeedbackSchema.parse(input);
  return (await apiPost<BookingFeedback>(`/mobile/bookings/${bookingId}/feedback`, {
    rating: values.rating,
    comment: values.comment || null,
  })).data;
}
