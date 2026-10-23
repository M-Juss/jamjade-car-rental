export function fromManilaInput(value: string) {
  return new Date(`${value}+08:00`).toISOString();
}

export function formatReturnDateTime(value?: string | null, includeSeconds = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", ...(includeSeconds ? { second: "2-digit" as const } : {}), hour12: true,
  }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value;
  const month = part("month");
  return `${month}${month === "May" ? "" : "."} ${part("day")}, ${part("year")}, ${part("hour")}:${part("minute")}${includeSeconds ? `:${part("second")}` : ""} ${part("dayPeriod")}`;
}

export function manilaTimeInput(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}
