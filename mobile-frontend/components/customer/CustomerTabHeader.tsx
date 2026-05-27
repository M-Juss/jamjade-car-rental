import { Text, View } from 'react-native';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function CustomerTabHeader({
  className,
  description,
}: {
  className?: string;
  description: string;
}) {
  return (
    <View className={cx('min-w-0', className)}>
      <Text className="text-[27px] font-black italic leading-[31px] text-[#346EF6]" numberOfLines={1}>
        JamJade Car Rental
      </Text>
      <Text className="mt-1 text-[18px] font-black leading-[23px] text-[#17315F]" numberOfLines={2}>
        {description}
      </Text>
    </View>
  );
}
