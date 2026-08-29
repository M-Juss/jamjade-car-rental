import { Redirect, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, Text, useWindowDimensions, View, type ImageStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';

const carHero = require('@/assets/images/vios-hero.png');

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function LandingScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isCompact = height < 760 || width < 380;
  const isTiny = height < 690 || width < 360;
  const screenClass = 'relative flex-1 w-full overflow-hidden bg-background px-5';
  const contentClass = cx(
    'z-10 flex-1 w-full self-center',
    width > 520 && 'max-w-[460px]',
  );
  const contentStyle = {
    paddingBottom: Math.max(insets.bottom + (isTiny ? 10 : 14), isTiny ? 12 : isCompact ? 16 : 20),
    paddingTop: Math.max(insets.top + (isTiny ? 8 : 12), isTiny ? 24 : isCompact ? 30 : 36),
  };
  const titleClass = isTiny
    ? 'text-[35px] font-black leading-[38px] text-foreground'
    : isCompact
      ? 'text-[39px] font-black leading-[42px] text-foreground'
      : 'text-[45px] font-black leading-[48px] text-foreground';
  const brandClass = isTiny
    ? 'text-[39px] font-black italic leading-[41px] text-primary'
    : isCompact
      ? 'text-[44px] font-black italic leading-[46px] text-primary'
      : 'text-[50px] font-black italic leading-[52px] text-primary';
  const rentalClass = isTiny
    ? 'mt-0 text-[24px] font-black italic leading-[28px] text-primary'
    : isCompact
      ? 'mt-0 text-[30px] font-black italic leading-[31px] text-primary'
      : 'mt-0 text-[37px] font-black italic leading-[40px] text-primary';
  const carFrameClass = isTiny
    ? 'h-[205px] w-[118%]'
    : isCompact
      ? 'h-[258px] w-[122%]'
      : 'h-[314px] w-[126%]';
  const carSectionClass = isTiny
    ? 'z-0 mt-1 min-h-[218px] items-center justify-center'
    : isCompact
      ? 'z-0 mt-2 min-h-[276px] items-center justify-center'
      : 'z-0 mt-3 min-h-[330px] items-center justify-center';
  const messageClass = isTiny
    ? 'text-[13px] font-semibold leading-[19px] text-foreground'
    : isCompact
      ? 'text-[14px] font-semibold leading-5 text-foreground'
      : 'text-[15px] font-semibold leading-[22px] text-foreground';
  const buttonHeightClass = isTiny ? 'min-h-[46px]' : isCompact ? 'min-h-[50px]' : 'min-h-[56px]';
  const primaryTextClass = isCompact
    ? 'text-[15px] font-extrabold text-surface'
    : 'text-[16px] font-extrabold text-surface';
  const secondaryTextClass = isCompact
    ? 'text-center text-[14px] font-extrabold text-foreground'
    : 'text-center text-[15px] font-extrabold text-foreground';

  if (status === 'authenticated') {
    return <Redirect href={user?.roles?.includes('driver') ? '/(driver)/services' : '/(tabs)'} />;
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor="transparent" style="dark" translucent />

      <View className={screenClass}>
        <View className="absolute right-[-128px] top-14 h-[318px] w-[318px] rounded-full bg-border" />
        <View className="absolute left-[-120px] top-[-92px] h-[260px] w-[260px] rounded-full bg-surface" />
        <View className="absolute left-7 top-[226px] h-9 w-9 rounded-full bg-[#BFD7FF] opacity-80" />
        <View className="absolute left-[72px] top-[278px] h-4 w-4 rounded-full bg-[#DAD7FF] opacity-90" />
        <View className="absolute right-10 top-[382px] h-8 w-8 rounded-full bg-[#CFF7E2] opacity-90" />
        <View className="absolute right-[86px] top-[422px] h-5 w-5 rounded-full bg-[#FFD7EA] opacity-80" />
        <View className="absolute left-[-20px] bottom-[218px] h-16 w-16 rounded-full bg-[#E7F0FF] opacity-95" />
        <View className="absolute left-10 bottom-[188px] h-6 w-6 rounded-full bg-[#CFF7E2] opacity-75" />
        <View className="absolute right-2 bottom-[114px] h-12 w-12 rounded-full bg-[#C9F0FF] opacity-90" />
        <View className="absolute right-[68px] bottom-[164px] h-4 w-4 rounded-full bg-[#BFD7FF] opacity-80" />
        <View className="absolute bottom-[178px] left-5 right-5 h-px bg-foreground/5" />

        <View className={contentClass} style={contentStyle}>
          <View>
            <Text className={titleClass}>
              Your Journey
            </Text>
            <Text className={titleClass}>Starts With</Text>
            <Text className={brandClass}>JamJade</Text>
            <Text className={rentalClass}>Car Rental</Text>
          </View>

          <View className={carSectionClass}>
            <View className={cx('max-w-[488px] items-center justify-center overflow-hidden', carFrameClass)}>
              <Image source={carHero} resizeMode="contain" style={$carImage} />
            </View>
          </View>

          <View className={cx('mt-auto gap-4', isCompact && 'gap-3', isTiny && 'gap-2.5')}>
            <View className="overflow-hidden rounded-[26px] border border-border bg-surface/90 px-4 py-3 shadow-sm shadow-primary/10">
              <View className="absolute bottom-[-28px] right-[-18px] h-20 w-20 rounded-full bg-border/60" />
              <View className="mb-2 flex-row items-center gap-2">
                <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                <Text className="text-[12px] font-black uppercase text-primary">
                  Premium Rentals
                </Text>
              </View>
              <Text className={messageClass}>
                Cars ready for errands, business meetings, and weekend escapes. Choose your ride and
                drive with confidence.
              </Text>
            </View>

            <View className={cx('gap-3', isCompact && 'gap-2.5')}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/login')}
                className={cx(
                  'items-center justify-center rounded-full bg-primary shadow-lg shadow-[#004BFA]/20',
                  buttonHeightClass,
                )}>
                <Text className={primaryTextClass}>Sign In or Create Account</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/vehicles')}
                className={cx(
                  'items-center justify-center rounded-full border border-primary/20 bg-surface',
                  buttonHeightClass,
                )}>
                <Text className={secondaryTextClass}>Browse Available Cars</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const $carImage: ImageStyle = {
  height: '100%',
  width: '100%',
};
