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

export function isFutureDate(value: string, today = new Date()) {
  const date = parseDateKey(value);

  if (!date) {
    return false;
  }

  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return date.getTime() > normalizedToday.getTime();
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
