import { toBookingTimestamp } from './booking-time';

export const PICKUP_TIME_STEP_MINUTES = 5;

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

export function getEarliestPickupDate(now = new Date()) {
  // The final pickup option is one step before midnight.
  return getLocalDateKey(new Date(now.getTime() + PICKUP_TIME_STEP_MINUTES * 60_000));
}

export function isFuturePickupTime(rentalDate: string, pickupTime: string, now = new Date()) {
  return Date.parse(toBookingTimestamp(`${rentalDate} ${pickupTime}`)) > now.getTime();
}

export function isBookablePickupDate(
  value: string,
  now = new Date(),
) {
  const timestamp = Date.parse(toBookingTimestamp(value));
  return Number.isFinite(timestamp) && getLocalDateKey(new Date(timestamp)) >= getLocalDateKey(now);
}
