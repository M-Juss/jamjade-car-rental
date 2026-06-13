import type { Booking, BookingStatus, BookingStatusFilter } from '@/types/booking';

export const formatPeso = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatPesoDeduction = (amount: number) => {
  if (amount <= 0) {
    return `-${formatPeso(0)}`;
  }

  return `-${formatPeso(amount)}`;
};

export const isTelematicsEnabled = (status: BookingStatus) => {
  return status === 'Active' || status === 'Ongoing';
};

export const matchesBookingStatus = (booking: Booking, status: BookingStatusFilter) => {
  if (status === 'All') {
    return true;
  }

  if (status === 'Active') {
    return booking.status === 'Active' || booking.status === 'Ongoing';
  }

  return booking.status === status;
};

export const matchesBookingSearch = (booking: Booking, searchTerm: string) => {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [booking.id, booking.vehicleName].join(' ').toLowerCase().includes(normalized);
};

export const getBookingSummaryCounts = (sourceBookings: Booking[]) => {
  return {
    total: sourceBookings.length,
    pending: sourceBookings.filter((booking) => booking.status === 'Pending').length,
    active: sourceBookings.filter((booking) => isTelematicsEnabled(booking.status)).length,
    completed: sourceBookings.filter((booking) => booking.status === 'Completed').length,
  };
};
