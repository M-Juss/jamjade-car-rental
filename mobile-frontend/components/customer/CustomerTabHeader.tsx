import { Image, Text, View } from 'react-native';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function CustomerTabHeader({
  className,
  title,
}: {
  className?: string;
  title: string;
}) {
  return (
    <View className={cx('min-w-0', className)}>
      <View className="flex-row items-center gap-2.5">
        <Image
          source={require('@/assets/images/JamJadeLogo.png')}
          className="h-12 w-12"
          resizeMode="contain"
        />
        <Text className="min-w-0 flex-1 text-[20px] font-black leading-6 text-foreground" numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}
