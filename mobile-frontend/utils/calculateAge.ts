function parseDateKey(value: string) {
  const [yearValue, monthValue, dayValue] = value.split('-').map(Number);

  if (!yearValue || !monthValue || !dayValue) {
    return null;
  }

  const date = new Date(yearValue, monthValue - 1, dayValue);

  if (
    date.getFullYear() !== yearValue ||
    date.getMonth() !== monthValue - 1 ||
    date.getDate() !== dayValue
  ) {
    return null;
  }

  return date;
}

export const MINIMUM_BOOKING_AGE = 18;

export const BOOKING_AGE_REQUIREMENT_MESSAGE =
  'You must be at least 18 years old to book with JamJade.';

export const BOOKING_AGE_RESTRICTION_MESSAGE =
  'JamJade only accepts bookings from customers aged 18 or older. If your saved birthdate is incorrect, update your profile before trying again.';

export function getLatestEligibleBirthdateKey(today = new Date()) {
  const targetYear = today.getFullYear() - MINIMUM_BOOKING_AGE;
  const lastDayOfTargetMonth = new Date(
    targetYear,
    today.getMonth() + 1,
    0,
  ).getDate();
  const cutoff = new Date(
    targetYear,
    today.getMonth(),
    Math.min(today.getDate(), lastDayOfTargetMonth),
  );

  return [
    cutoff.getFullYear(),
    String(cutoff.getMonth() + 1).padStart(2, '0'),
    String(cutoff.getDate()).padStart(2, '0'),
  ].join('-');
}

export function calculateAge(birthdate: string, today = new Date()) {
  const birthDate = parseDateKey(birthdate);

  if (!birthDate) {
    return null;
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

export function isBookingAgeEligible(birthdate: string, today = new Date()) {
  const age = calculateAge(birthdate, today);

  return age !== null && age >= MINIMUM_BOOKING_AGE;
}

export function isFutureDate(value: string, today = new Date()) {
  const date = parseDateKey(value);

  if (!date) {
    return false;
  }

  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return date.getTime() > normalizedToday.getTime();
}

export function isPastDate(value: string, today = new Date()) {
  const date = parseDateKey(value);

  if (!date) {
    return false;
  }

  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return date.getTime() < normalizedToday.getTime();
}

export function formatDisplayDate(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatNumericDate(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return value;
  }

  return [
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    date.getFullYear(),
  ].join('/');
}
