import type { PenaltyLog } from '@/types/telematics';

const PESO_FORMATTER = new Intl.NumberFormat('en-PH', {
  currency: 'PHP',
  maximumFractionDigits: 0,
  style: 'currency',
});

function padTime(value: number) {
  return value.toString().padStart(2, '0');
}

export function formatPeso(value: number) {
  return PESO_FORMATTER.format(value);
}

export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDuration(milliseconds: number, includeSeconds = true) {
  const absoluteMilliseconds = Math.max(0, Math.abs(milliseconds));
  const totalSeconds = Math.floor(absoluteMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (!includeSeconds) {
    return `${padTime(hours)}h ${padTime(minutes)}m`;
  }

  return `${padTime(hours)}h ${padTime(minutes)}m ${padTime(seconds)}s`;
}

export function getTimerState(returnDateTime: string, currentTime: Date) {
  const returnTime = new Date(returnDateTime).getTime();
  const difference = returnTime - currentTime.getTime();
  const isOverdue = difference < 0;
  const isEndingSoon = !isOverdue && difference <= 60 * 60 * 1000;

  return {
    difference,
    isEndingSoon,
    isOverdue,
    remainingLabel: formatDuration(difference),
  };
}

export function calculatePenalty({
  currentTime,
  hourlyPenaltyRate,
  returnDateTime,
}: {
  currentTime: Date;
  returnDateTime: string;
  hourlyPenaltyRate: number;
}) {
  const returnTime = new Date(returnDateTime);
  const overdueMilliseconds = Math.max(0, currentTime.getTime() - returnTime.getTime());
  const overdueMinutes = Math.ceil(overdueMilliseconds / 60_000);
  const penaltyHours = overdueMinutes > 0 ? Math.ceil(overdueMinutes / 60) : 0;
  const penaltyCharge = penaltyHours * hourlyPenaltyRate;
  const penaltyLogs: PenaltyLog[] = [];

  for (let hour = 0; hour < penaltyHours; hour += 1) {
    const logTime = new Date(returnTime.getTime() + hour * 60 * 60 * 1000 + 60 * 1000);
    const formattedTime = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(logTime);

    penaltyLogs.push({
      id: `penalty-${hour + 1}`,
      charge: hourlyPenaltyRate,
      description:
        hour === 0
          ? `Rental became overdue at ${formattedTime}`
          : `Additional overdue hour reached at ${formattedTime}`,
      time: formattedTime,
    });
  }

  return {
    overdueLabel: formatDuration(overdueMilliseconds, false),
    overdueMinutes,
    penaltyCharge,
    penaltyHours,
    penaltyLogs,
  };
}
