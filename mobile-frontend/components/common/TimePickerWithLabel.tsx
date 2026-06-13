import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const PERIODS = ['AM', 'PM'] as const;

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
    period: hour24 >= 12 ? 'PM' as Period : 'AM' as Period,
  };
}

function toTimeValue(hour: number, minute: number, period: Period) {
  const hour24 = period === 'AM'
    ? hour % 12
    : (hour % 12) + 12;

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
  isSelected,
  label,
  onPress,
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={cx(
        'min-h-[44px] items-center justify-center rounded-2xl border px-3',
        isSelected
          ? 'border-[#346EF6] bg-[#346EF6]'
          : 'border-[#E6EEFF] bg-white',
      )}>
      <Text className={cx('text-[14px] font-black', isSelected ? 'text-white' : 'text-[#17315F]')}>
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
  placeholder = 'Select time',
  required = false,
  value,
  wrapperClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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

  useEffect(() => {
    if (isOpen) {
      setSelectedHour(parsedTime.hour);
      setSelectedMinute(parsedTime.minute);
      setSelectedPeriod(parsedTime.period);
    }
  }, [isOpen, parsedTime]);

  const handleApply = () => {
    onChange(toTimeValue(selectedHour, selectedMinute, selectedPeriod));
    setIsOpen(false);
  };

  return (
    <View className={cx('relative gap-2', error || helperText ? 'mb-8' : 'mb-4', wrapperClassName)}>
      <Text className="text-[12px] font-bold text-[#17315F]">
        {label}
        {required ? <Text className="text-[#E5484D]"> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        className={cx(
          'min-h-[48px] flex-row items-center rounded-full border bg-white px-4',
          error ? 'border-[#F4A6A6] bg-[#FFF8F8]' : 'border-[#E5EAF2]',
        )}>
        <MaterialIcons name="schedule" size={20} color="#7D8798" />
        <Text
          className={cx(
            'min-w-0 flex-1 px-3 text-[14px] font-semibold',
            value ? 'text-[#17315F]' : 'font-medium text-[#9AA4B8]',
          )}>
          {value ? formatTimeWithPeriod(value) : placeholder}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color="#7D8798" />
      </Pressable>

      <View className="absolute left-1 right-1 top-full mt-1.5">
        {error || helperText ? (
          <Text className={cx('text-[11px] leading-4 text-[#667085]', error && 'font-bold text-[#D92D20]')}>
            {error || helperText}
          </Text>
        ) : null}
      </View>

      <Modal animationType="fade" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 justify-end bg-black/35">
          <Pressable
            accessibilityLabel="Close time picker"
            accessibilityRole="button"
            className="flex-1"
            onPress={() => setIsOpen(false)}
          />
          <View
            className="rounded-t-[32px] bg-[#F8FAFF] px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}>
            <View className="mb-4 items-center">
              <View className="h-1.5 w-12 rounded-full bg-[#CBD5E1]" />
            </View>
            <View className="mb-5 flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-[22px] font-black text-[#17315F]">{label}</Text>
                <Text className="mt-1 text-[12px] font-bold text-[#6C7A96]">
                  Choose the hour, minute, and AM or PM.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close time picker"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-white">
                <MaterialIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">
                  Hour
                </Text>
                <ScrollView className="h-[220px]" showsVerticalScrollIndicator={false}>
                  <View className="gap-2">
                    {HOURS.map((hour) => (
                      <TimeOption
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
                <Text className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">
                  Minute
                </Text>
                <ScrollView className="h-[220px]" showsVerticalScrollIndicator={false}>
                  <View className="gap-2">
                    {MINUTES.map((minute) => (
                      <TimeOption
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
                <Text className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.8px] text-[#91A0B8]">
                  Period
                </Text>
                <View className="gap-2">
                  {PERIODS.map((period) => (
                    <TimeOption
                      key={period}
                      isSelected={selectedPeriod === period}
                      label={period}
                      onPress={() => setSelectedPeriod(period)}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View className="mt-5 rounded-[22px] border border-[#DDE8FF] bg-white px-4 py-3">
              <Text className="text-center text-[12px] font-bold text-[#6C7A96]">Selected time</Text>
              <Text className="mt-1 text-center text-[22px] font-black text-[#17315F]">
                {formatTimeWithPeriod(toTimeValue(selectedHour, selectedMinute, selectedPeriod))}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={handleApply}
              className="mt-4 min-h-[56px] items-center justify-center rounded-full bg-[#346EF6]">
              <Text className="text-[15px] font-black text-white">Apply Time</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
