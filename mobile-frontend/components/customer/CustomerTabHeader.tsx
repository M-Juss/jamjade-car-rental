import { Image, Text, View } from 'react-native';

import { LogoutHeaderButton } from '@/components/auth/LogoutHeaderButton';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function CustomerTabHeader({ className, title }: { className?: string; title: string }) {
  return (
    <View className={cx('min-w-0', className)}>
      <View className="flex-row items-center gap-2.5">
        <Image
          source={require('@/assets/images/JamJadeLogo-gradient.png')}
          accessibilityLabel="JamJade Car Rental"
          style={{ height: 40, width: 40 }}
          resizeMode="contain"
        />
        <Text
          className="font-sans min-w-0 flex-1 text-[22px] font-semibold leading-[28px] text-foreground"
          numberOfLines={1}>
          {title}
        </Text>
        <LogoutHeaderButton />
      </View>
    </View>
  );
}
