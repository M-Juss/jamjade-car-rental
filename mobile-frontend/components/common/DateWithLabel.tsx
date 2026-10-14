import { themeColors } from '@/constants/theme';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function parseDateKey(value?: string) {
  if (!value) {
    return null;
  }

  const [yearValue, monthValue, dayValue] = value.split('-').map(Number);

  if (!yearValue || !monthValue || !dayValue) {
    return null;
  }

  const date = new Date(yearValue, monthValue - 1, dayValue);

  if (date.getFullYear() !== yearValue || date.getMonth() !== monthValue - 1 || date.getDate() !== dayValue) {
    return null;
  }

  return date;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function getFirstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDisplayDate(value: string) {
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

function getCalendarCells(monthDate: Date) {
  const monthStart = getFirstDayOfMonth(monthDate);
  const leadingEmptyCells = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function isDateInRange(dateKey: string, ranges: { startDate: string; endDate: string }[]) {
  return ranges.some((range) => dateKey >= range.startDate && dateKey <= range.endDate);
}

export function getNextDateKey(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return getTodayKey();
  }

  date.setDate(date.getDate() + 1);
  return formatDateKey(date);
}

export function getPreviousDateKey(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return getTodayKey();
  }

  date.setDate(date.getDate() - 1);
  return formatDateKey(date);
}

export function DateWithLabel({
  disabledDateRanges = [],
  error,
  helperText,
  label,
  maximumDate,
  minimumDate = getTodayKey(),
  onChange,
  placeholder = 'Select date',
  value,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: string;
  maximumDate?: string;
  disabledDateRanges?: { startDate: string; endDate: string }[];
  helperText?: string;
  error?: string;
}) {
  const insets = useSafeAreaInsets();
  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const minimumSelectableDate = useMemo(
    () => startOfDay(parseDateKey(minimumDate) ?? new Date()),
    [minimumDate],
  );
  const maximumSelectableDate = useMemo(() => parseDateKey(maximumDate), [maximumDate]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getFirstDayOfMonth(selectedDate ?? minimumSelectableDate),
  );

  const calendarCells = useMemo(() => getCalendarCells(visibleMonth), [visibleMonth]);
  const minimumMonth = getFirstDayOfMonth(minimumSelectableDate);
  const canGoToPreviousMonth = visibleMonth.getTime() > minimumMonth.getTime();
  const canGoToNextMonth =
    !maximumSelectableDate || visibleMonth.getTime() < getFirstDayOfMonth(maximumSelectableDate).getTime();

  useEffect(() => {
    if (isCalendarOpen) {
      setVisibleMonth(getFirstDayOfMonth(selectedDate ?? minimumSelectableDate));
    }
  }, [isCalendarOpen, minimumSelectableDate, selectedDate]);

  const goToNextMonth = () => {
    if (!canGoToNextMonth) {
      return;
    }

    setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToPreviousMonth = () => {
    if (!canGoToPreviousMonth) {
      return;
    }

    setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleSelectDate = (date: Date) => {
    const dateKey = formatDateKey(date);

    if (
      startOfDay(date).getTime() < minimumSelectableDate.getTime() ||
      (maximumSelectableDate && startOfDay(date).getTime() > startOfDay(maximumSelectableDate).getTime()) ||
      isDateInRange(dateKey, disabledDateRanges)
    ) {
      return;
    }

    onChange(dateKey);
    setIsCalendarOpen(false);
  };

  return (
    <View className={cx('relative gap-2', error || helperText ? 'mb-8' : 'mb-4')}>
      <Text className="font-sans text-[12px] font-normal text-secondary-foreground">{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsCalendarOpen(true)}
        className={cx(
          'min-h-[54px] flex-row items-center rounded-2xl border bg-surface px-4',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-border',
        )}>
        <CalendarDays size={18} color={themeColors.primary} strokeWidth={2.35} />
        <Text
          className={cx(
            'font-sans',
            'min-w-0 flex-1 px-3 text-[15px] font-medium',
            value ? 'text-foreground' : 'text-secondary-foreground',
          )}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>
      <View className="absolute left-1 right-1 top-full mt-1.5">
        {error || helperText ? (
          <Text
            className={cx(
              'font-sans',
              'text-[11px] font-medium leading-4 text-secondary-foreground',
              error && 'text-destructive',
            )}>
            {error || helperText}
          </Text>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isCalendarOpen}
        onRequestClose={() => setIsCalendarOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <Pressable accessibilityRole="button" className="flex-1" onPress={() => setIsCalendarOpen(false)} />
          <View
            className="rounded-t-sheet bg-background px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}>
            <View className="mb-4 items-center">
              <View className="h-1.5 w-12 rounded-full bg-border" />
            </View>
            <View className="mb-5 flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-[22px] font-semibold text-foreground">{label}</Text>
                <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                  {disabledDateRanges.length > 0
                    ? 'Past dates and confirmed booking dates are disabled.'
                    : 'Past dates are disabled.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                hitSlop={8}
                onPress={() => setIsCalendarOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                <X size={19} color={themeColors.mutedForeground} strokeWidth={2.45} />
              </Pressable>
            </View>

            <View className="rounded-card border border-border bg-surface p-4">
              <View className="flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoToPreviousMonth }}
                  onPress={goToPreviousMonth}
                  className={cx(
                    'h-10 w-10 items-center justify-center rounded-full',
                    canGoToPreviousMonth ? 'bg-muted' : 'bg-muted',
                  )}>
                  <ChevronLeft
                    size={19}
                    color={canGoToPreviousMonth ? themeColors.primary : '#CBD5E1'}
                    strokeWidth={2.45}
                  />
                </Pressable>
                <Text className="font-sans text-[17px] font-semibold text-foreground">
                  {getMonthTitle(visibleMonth)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoToNextMonth }}
                  disabled={!canGoToNextMonth}
                  onPress={goToNextMonth}
                  className={cx(
                    'h-10 w-10 items-center justify-center rounded-full',
                    canGoToNextMonth ? 'bg-muted' : 'bg-muted',
                  )}>
                  <ChevronRight
                    size={19}
                    color={canGoToNextMonth ? themeColors.primary : '#CBD5E1'}
                    strokeWidth={2.45}
                  />
                </Pressable>
              </View>

              <View className="mt-4 flex-row">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                  <Text
                    key={weekday}
                    className="font-sans text-center text-[11px] font-normal text-secondary-foreground"
                    style={{ width: `${100 / 7}%` }}>
                    {weekday}
                  </Text>
                ))}
              </View>

              <View className="mt-2 flex-row flex-wrap">
                {calendarCells.map((date, index) => {
                  if (!date) {
                    return <View key={`empty-${index}`} className="h-11" style={{ width: `${100 / 7}%` }} />;
                  }

                  const dateKey = formatDateKey(date);
                  const isSelected = value === dateKey;
                  const isPastDate = startOfDay(date).getTime() < minimumSelectableDate.getTime();
                  const isAfterMaximum = Boolean(
                    maximumSelectableDate &&
                    startOfDay(date).getTime() > startOfDay(maximumSelectableDate).getTime(),
                  );
                  const isBookedDate = isDateInRange(dateKey, disabledDateRanges);
                  const isDisabled = isPastDate || isAfterMaximum || isBookedDate;

                  return (
                    <View
                      key={dateKey}
                      className="h-11 items-center justify-center"
                      style={{ width: `${100 / 7}%` }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                        disabled={isDisabled}
                        onPress={() => handleSelectDate(date)}
                        className={cx(
                          'h-9 w-9 items-center justify-center rounded-full',
                          isSelected && 'bg-primary',
                          !isSelected && !isDisabled && 'bg-surface',
                          isDisabled && 'bg-muted',
                        )}>
                        <Text
                          className={cx(
                            'font-sans',
                            'text-[13px] font-semibold',
                            isSelected && 'text-surface',
                            !isSelected && !isDisabled && 'text-foreground',
                            isDisabled && 'text-border',
                          )}>
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
