function padTimePart(value: number) {
  return value.toString().padStart(2, '0');
}

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;
}

export function getLocalTimeKey(date = new Date()) {
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

export function isFuturePickupTime(
  rentalDate: string,
  pickupTime: string,
  now = new Date(),
) {
  return rentalDate !== getLocalDateKey(now) || pickupTime > getLocalTimeKey(now);
}
