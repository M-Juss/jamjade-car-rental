export function dashboardDateTime(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...options }).format(new Date(value));
}

// Calendar navigation uses local Date fields. Give it Manila wall-clock fields
// so the schedule remains correct even when the browser uses another timezone.
export function calendarDate(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(number("year"), number("month") - 1, number("day"), number("hour"), number("minute"), number("second"));
}
