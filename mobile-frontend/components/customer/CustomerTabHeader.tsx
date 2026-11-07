import { Image, Text, View } from 'react-native';

import { LogoutHeaderButton } from '@/components/auth/LogoutHeaderButton';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function CustomerTabHeader({
  className,
  showLogout = false,
  title,
}: {
  className?: string;
  showLogout?: boolean;
  title: string;
}) {
  return (
    <View className={cx('min-w-0 pt-1', className)}>
      <View className="flex-row items-center gap-2.5">
        <Image
          source={require('@/assets/images/JamJadeLogo-solid.png')}
          accessibilityLabel="JamJade Car Rental"
          style={{ height: 40, width: 40, flexShrink: 0 }}
          resizeMode="contain"
        />
        <Text
          className="font-sans min-w-0 flex-1 text-title font-semibold text-foreground">
          {title}
        </Text>
        {showLogout ? <LogoutHeaderButton /> : null}
      </View>
    </View>
  );
}
