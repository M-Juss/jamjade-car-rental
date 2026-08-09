import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { BookingForm } from '@/forms/booking/BookingForm';

export default function BookingFormScreen() {
  return (
    <AuthenticatedOnly>
      <BookingForm />
    </AuthenticatedOnly>
  );
}
