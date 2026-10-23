// Booking form dates and clock times are entered in Asia/Manila.
export function toBookingTimestamp(value: string) {
  const timestamp = value.trim().replace(' ', 'T');
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return timestamp;
  return `${timestamp.length === 10 ? `${timestamp}T00:00:00` : timestamp}+08:00`;
}
