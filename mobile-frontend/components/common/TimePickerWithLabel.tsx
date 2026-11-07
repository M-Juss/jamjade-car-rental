import { themeColors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocalDateKey, getLocalTimeKey } from '@/lib/browse/pickup-time';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const PERIODS = ['AM', 'PM'] as const;
const TIME_VALUES = Array.from({ length: 24 * 12 }, (_, index) => {
  const hour = Math.floor(index / 12);
  const minute = (index % 12) * 5;

  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

type Period = (typeof PERIODS)[number];

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return {
      hour: 9,
      minute: 0,
      period: 'AM' as Period,
    };
  }

  const hour24 = Number(match[1]);

  return {
    hour: hour24 % 12 || 12,
    minute: Number(match[2]),
    period: hour24 >= 12 ? ('PM' as Period) : ('AM' as Period),
  };
}

function toTimeValue(hour: number, minute: number, period: Period) {
  const hour24 = period === 'AM' ? hour % 12 : (hour % 12) + 12;

  return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function formatTimeWithPeriod(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return value;
  }

  const hour24 = Number(match[1]);
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';

  return `${hour12}:${match[2]} ${period}`;
}

function TimeOption({
  disabled = false,
  isSelected,
  label,
  onPress,
}: {
  disabled?: boolean;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'min-h-[44px] items-center justify-center rounded-card border px-3',
        disabled
          ? 'border-border bg-muted opacity-45'
          : isSelected
            ? 'border-primary bg-primary'
            : 'border-border bg-surface',
      )}>
      <Text
        className={cx(
          'font-sans',
          'text-[15px]',
          isSelected && !disabled ? 'text-surface' : 'text-foreground',
        )}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TimePickerWithLabel({
  error,
  helperText,
  label,
  onChange,
  pickupDate,
  placeholder = 'Select time',
  required = false,
  value,
  wrapperClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  pickupDate?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  wrapperClassName?: string;
}) {
  const insets = useSafeAreaInsets();
  const parsedTime = useMemo(() => parseTime(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(parsedTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsedTime.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(parsedTime.period);
  const minimumTime = pickupDate === getLocalDateKey() ? getLocalTimeKey() : undefined;
  const availableTimeValues = useMemo(
    () => TIME_VALUES.filter((time) => !minimumTime || time > minimumTime),
    [minimumTime],
  );
  const hasAvailableTimes = availableTimeValues.length > 0;

  useEffect(() => {
    if (isOpen) {
      const initialTime = availableTimeValues.includes(value) ? value : availableTimeValues[0];
      const initialParts = parseTime(initialTime ?? '');

      setSelectedHour(initialParts.hour);
      setSelectedMinute(initialParts.minute);
      setSelectedPeriod(initialParts.period);
    }
  }, [availableTimeValues, isOpen, value]);

  const handleApply = () => {
    const nextValue = toTimeValue(selectedHour, selectedMinute, selectedPeriod);

    if (!availableTimeValues.includes(nextValue)) {
      return;
    }

    onChange(nextValue);
    setIsOpen(false);
  };

  const isUnavailable = (hour: number, minute: number, period: Period) =>
    !availableTimeValues.includes(toTimeValue(hour, minute, period));
  const pickerHelperText =
    !hasAvailableTimes && pickupDate === getLocalDateKey()
      ? 'No pickup times remain today. Select a future rental date.'
      : helperText;

  return (
    <View className={cx('gap-2 mb-4', wrapperClassName)}>
      <Text className="font-sans text-caption font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !hasAvailableTimes }}
        disabled={!hasAvailableTimes}
        onPress={() => setIsOpen(true)}
        className={cx(
          'min-h-control flex-row items-center rounded-field border bg-surface px-4',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-[#E5EAF2]',
          !hasAvailableTimes && 'opacity-60',
        )}>
        <MaterialIcons name="schedule" size={20} color={themeColors.mutedForeground} />
        <Text
          className={cx(
            'font-sans',
            'min-w-0 flex-1 px-3 text-[15px]',
            value ? 'text-foreground' : 'font-medium text-secondary-foreground',
          )}>
          {value ? formatTimeWithPeriod(value) : placeholder}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color={themeColors.mutedForeground} />
      </Pressable>

      {error || pickerHelperText ? (
        <Text
          className={cx(
            'font-sans',
            'px-1 text-[11px] leading-4 text-secondary-foreground',
            error && 'font-medium text-destructive',
          )}>
          {error || pickerHelperText}
        </Text>
      ) : null}

      <Modal animationType="fade" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <Pressable
            accessibilityLabel="Close time picker"
            accessibilityRole="button"
            className="flex-1"
            onPress={() => setIsOpen(false)}
          />
          <View
            className="rounded-t-sheet bg-background px-screen pt-4"
            style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}>
            <View className="mb-4 items-center">
              <View className="h-1.5 w-12 rounded-full bg-border" />
            </View>
            <View className="mb-section flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-[22px] font-semibold text-foreground">{label}</Text>
                <Text className="font-sans mt-1 text-[12px] font-medium text-secondary-foreground">
                  Choose the hour, minute, and AM or PM.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close time picker"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                <MaterialIcons name="close" size={20} color={themeColors.mutedForeground} />
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="font-sans mb-2 text-center text-[11px] font-normal text-secondary-foreground">
                  Hour
                </Text>
                <ScrollView className="h-[220px]" showsVerticalScrollIndicator={false}>
                  <View className="gap-2">
                    {HOURS.map((hour) => (
                      <TimeOption
                        disabled={isUnavailable(hour, selectedMinute, selectedPeriod)}
                        key={hour}
                        isSelected={selectedHour === hour}
                        label={String(hour)}
                        onPress={() => setSelectedHour(hour)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View className="flex-1">
                <Text className="font-sans mb-2 text-center text-[11px] font-normal text-secondary-foreground">
                  Minute
                </Text>
                <ScrollView className="h-[220px]" showsVerticalScrollIndicator={false}>
                  <View className="gap-2">
                    {MINUTES.map((minute) => (
                      <TimeOption
                        disabled={isUnavailable(selectedHour, minute, selectedPeriod)}
                        key={minute}
                        isSelected={selectedMinute === minute}
                        label={minute.toString().padStart(2, '0')}
                        onPress={() => setSelectedMinute(minute)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View className="flex-1">
                <Text className="font-sans mb-2 text-center text-[11px] font-normal text-secondary-foreground">
                  Period
                </Text>
                <View className="gap-2">
                  {PERIODS.map((period) => (
                    <TimeOption
                      disabled={
                        !HOURS.some((hour) => MINUTES.some((minute) => !isUnavailable(hour, minute, period)))
                      }
                      key={period}
                      isSelected={selectedPeriod === period}
                      label={period}
                      onPress={() => setSelectedPeriod(period)}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View className="mt-section rounded-card border border-border bg-surface px-4 py-3">
              <Text className="font-sans text-center text-[12px] font-medium text-secondary-foreground">
                Selected time
              </Text>
              <Text className="font-sans mt-1 text-center text-[22px] font-semibold text-foreground">
                {formatTimeWithPeriod(toTimeValue(selectedHour, selectedMinute, selectedPeriod))}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isUnavailable(selectedHour, selectedMinute, selectedPeriod) }}
              disabled={isUnavailable(selectedHour, selectedMinute, selectedPeriod)}
              onPress={handleApply}
              className={cx(
                'mt-4 min-h-control items-center justify-center rounded-field bg-primary',
                isUnavailable(selectedHour, selectedMinute, selectedPeriod) && 'opacity-50',
              )}>
              <Text className="font-sans text-[15px] font-semibold text-surface">Apply Time</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
