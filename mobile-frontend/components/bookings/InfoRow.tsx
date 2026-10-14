import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cx } from './utils';

export function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2.5">
      <Text className="font-sans min-w-0 flex-1 text-[13px] font-medium leading-5 text-secondary-foreground">
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text
          className={cx(
            'font-sans',
            'max-w-[58%] text-right text-[13px] font-semibold leading-5 text-foreground',
            valueClassName,
          )}>
          {value}
        </Text>
      ) : (
        <View className="max-w-[58%] items-end">{value}</View>
      )}
    </View>
  );
}
