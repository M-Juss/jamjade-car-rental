import { themeColors } from '@/constants/theme';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

export function getDateKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function getTodayDateKey() {
  return getDateKey(new Date());
}

export function getRelativeDateKey(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);

  return getDateKey(date);
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

function isBeforeMinimum(date: Date, minimumDate?: Date | null) {
  return Boolean(minimumDate && startOfDay(date).getTime() < startOfDay(minimumDate).getTime());
}

function isAfterMaximum(date: Date, maximumDate?: Date | null) {
  return Boolean(maximumDate && startOfDay(date).getTime() > startOfDay(maximumDate).getTime());
}

export function DatePickerInput({
  disabled = false,
  error,
  helperText,
  initialVisibleDate,
  label,
  maximumDate,
  minimumDate,
  onChange,
  placeholder = 'Select date',
  required = false,
  value,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: string;
  maximumDate?: string;
  initialVisibleDate?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const minimumSelectableDate = useMemo(() => parseDateKey(minimumDate), [minimumDate]);
  const maximumSelectableDate = useMemo(() => parseDateKey(maximumDate), [maximumDate]);
  const initialVisibleDateObject = useMemo(() => parseDateKey(initialVisibleDate), [initialVisibleDate]);
  const fallbackVisibleDate = useMemo(
    () =>
      selectedDate ??
      initialVisibleDateObject ??
      maximumSelectableDate ??
      minimumSelectableDate ??
      new Date(),
    [initialVisibleDateObject, maximumSelectableDate, minimumSelectableDate, selectedDate],
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getFirstDayOfMonth(fallbackVisibleDate));

  const calendarCells = useMemo(() => getCalendarCells(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (isCalendarOpen) {
      setVisibleMonth(getFirstDayOfMonth(fallbackVisibleDate));
    }
  }, [fallbackVisibleDate, isCalendarOpen]);

  const canGoToPreviousMonth =
    !minimumSelectableDate ||
    getFirstDayOfMonth(visibleMonth).getTime() > getFirstDayOfMonth(minimumSelectableDate).getTime();
  const canGoToNextMonth =
    !maximumSelectableDate ||
    getFirstDayOfMonth(visibleMonth).getTime() < getFirstDayOfMonth(maximumSelectableDate).getTime();

  const shiftMonth = (monthDelta: number) => {
    setVisibleMonth(
      (currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthDelta, 1),
    );
  };

  const shiftYear = (yearDelta: number) => {
    setVisibleMonth(
      (currentMonth) => new Date(currentMonth.getFullYear() + yearDelta, currentMonth.getMonth(), 1),
    );
  };

  const handleSelectDate = (date: Date) => {
    if (isBeforeMinimum(date, minimumSelectableDate) || isAfterMaximum(date, maximumSelectableDate)) {
      return;
    }

    onChange(getDateKey(date));
    setIsCalendarOpen(false);
  };

  return (
    <View className="gap-1.5">
      <Text className="font-sans text-caption font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setIsCalendarOpen(true)}
        className={cx(
          'min-h-control flex-row items-center rounded-field border bg-surface px-4',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-border',
          disabled && 'opacity-70',
        )}>
        <CalendarDays size={18} color={themeColors.primary} strokeWidth={2.35} />
        <Text
          className={cx(
            'font-sans',
            'min-w-0 flex-1 px-3 text-[15px]',
            value ? 'text-foreground' : 'text-secondary-foreground',
          )}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>
      <View className={error || helperText ? 'px-1' : 'hidden'}>
        {error || helperText ? (
          <Text
            className={cx(
              'font-sans',
              'text-caption text-secondary-foreground',
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
                  Choose a date from the calendar.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close calendar"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsCalendarOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                <X size={19} color={themeColors.mutedForeground} strokeWidth={2.45} />
              </Pressable>
            </View>

            <View className="rounded-card border border-border bg-surface p-4">
              <View className="flex-row items-center justify-between gap-2">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => shiftYear(-1)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <ChevronsLeft size={18} color={themeColors.primary} strokeWidth={2.45} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoToPreviousMonth }}
                  disabled={!canGoToPreviousMonth}
                  onPress={() => shiftMonth(-1)}
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
                <Text className="font-sans min-w-0 flex-1 text-center text-[16px] font-semibold text-foreground">
                  {getMonthTitle(visibleMonth)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoToNextMonth }}
                  disabled={!canGoToNextMonth}
                  onPress={() => shiftMonth(1)}
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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => shiftYear(1)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <ChevronsRight size={18} color={themeColors.primary} strokeWidth={2.45} />
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

                  const dateKey = getDateKey(date);
                  const isSelected = value === dateKey;
                  const isDisabled =
                    isBeforeMinimum(date, minimumSelectableDate) ||
                    isAfterMaximum(date, maximumSelectableDate);

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
