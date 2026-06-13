const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
export const DOWN_PAYMENT_MINIMUM_LEAD_DAYS = 2;

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

export function getBookingLeadDays(rentalDate: string, currentDate = new Date()) {
  const rentalTimestamp = parseDateKey(rentalDate);

  if (rentalTimestamp === null) {
    return 0;
  }

  const currentTimestamp = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );

  return Math.floor((rentalTimestamp - currentTimestamp) / DAY_IN_MILLISECONDS);
}

export function canUseDownPayment(rentalDate: string, currentDate = new Date()) {
  return getBookingLeadDays(rentalDate, currentDate) >= DOWN_PAYMENT_MINIMUM_LEAD_DAYS;
}
