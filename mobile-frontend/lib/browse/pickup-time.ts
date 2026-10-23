import { toBookingTimestamp } from './booking-time';

function manilaParts(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
}

export function getLocalDateKey(date = new Date()) {
  const parts = manilaParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getLocalTimeKey(date = new Date()) {
  const parts = manilaParts(date);
  return `${parts.find((part) => part.type === 'hour')?.value}:${parts.find((part) => part.type === 'minute')?.value}`;
}

export function isFuturePickupTime(
  rentalDate: string,
  pickupTime: string,
  now = new Date(),
) {
  return Date.parse(toBookingTimestamp(`${rentalDate} ${pickupTime}`)) > now.getTime();
}
