import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, Text, useWindowDimensions, View, type ImageStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const carHero = require('@/assets/images/vios-hero.png');

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function LandingScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const isCompact = height < 760 || width < 380;
  const isTiny = height < 690 || width < 360;
  const screenClass = width > 520
    ? 'relative flex-1 w-full max-w-[430px] self-center overflow-hidden border-x border-[#DDE8FF] bg-[#F8FAFF] px-5 shadow-2xl shadow-[#346EF6]/15'
    : 'relative flex-1 w-full max-w-[430px] self-center overflow-hidden bg-[#F8FAFF] px-5';
  const titleClass = isTiny
    ? 'text-[35px] font-black leading-[38px] text-[#17315F]'
    : isCompact
      ? 'text-[39px] font-black leading-[42px] text-[#17315F]'
      : 'text-[45px] font-black leading-[48px] text-[#17315F]';
  const brandClass = isTiny
    ? 'text-[39px] font-black italic leading-[41px] text-[#346EF6]'
    : isCompact
      ? 'text-[44px] font-black italic leading-[46px] text-[#346EF6]'
      : 'text-[50px] font-black italic leading-[52px] text-[#346EF6]';
  const rentalClass = isTiny
    ? 'mt-0 text-[24px] font-black italic leading-[28px] text-[#346EF6]'
    : isCompact
      ? 'mt-0 text-[30px] font-black italic leading-[31px] text-[#346EF6]'
      : 'mt-0 text-[37px] font-black italic leading-[40px] text-[#346EF6]';
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
    ? 'text-[13px] font-semibold leading-[19px] text-[#17315F]'
    : isCompact
      ? 'text-[14px] font-semibold leading-5 text-[#17315F]'
      : 'text-[15px] font-semibold leading-[22px] text-[#17315F]';
  const buttonHeightClass = isTiny ? 'min-h-[46px]' : isCompact ? 'min-h-[50px]' : 'min-h-[56px]';
  const primaryTextClass = isCompact
    ? 'text-[15px] font-extrabold text-white'
    : 'text-[16px] font-extrabold text-white';
  const secondaryTextClass = isCompact
    ? 'text-center text-[14px] font-extrabold text-[#17315F]'
    : 'text-center text-[15px] font-extrabold text-[#17315F]';

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor="transparent" style="dark" translucent />

      <View className={screenClass}>
        <View className="absolute right-[-128px] top-14 h-[318px] w-[318px] rounded-full bg-[#DDE8FF]" />
        <View className="absolute left-[-120px] top-[-92px] h-[260px] w-[260px] rounded-full bg-white" />
        <View className="absolute left-7 top-[226px] h-9 w-9 rounded-full bg-[#BFD7FF] opacity-80" />
        <View className="absolute left-[72px] top-[278px] h-4 w-4 rounded-full bg-[#DAD7FF] opacity-90" />
        <View className="absolute right-10 top-[382px] h-8 w-8 rounded-full bg-[#CFF7E2] opacity-90" />
        <View className="absolute right-[86px] top-[422px] h-5 w-5 rounded-full bg-[#FFD7EA] opacity-80" />
        <View className="absolute left-[-20px] bottom-[218px] h-16 w-16 rounded-full bg-[#E7F0FF] opacity-95" />
        <View className="absolute left-10 bottom-[188px] h-6 w-6 rounded-full bg-[#CFF7E2] opacity-75" />
        <View className="absolute right-2 bottom-[114px] h-12 w-12 rounded-full bg-[#C9F0FF] opacity-90" />
        <View className="absolute right-[68px] bottom-[164px] h-4 w-4 rounded-full bg-[#BFD7FF] opacity-80" />
        <View className="absolute bottom-[178px] left-5 right-5 h-px bg-[#17315F]/5" />

        <View className={cx('z-10 pt-3', isCompact && 'pt-2', isTiny && 'pt-1')}>
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

        <View className={cx('z-10 mt-auto gap-4', isCompact && 'gap-3', isTiny && 'gap-2.5')}>
          <View className="overflow-hidden rounded-[26px] border border-[#DDE8FF] bg-white/90 px-4 py-3 shadow-sm shadow-[#346EF6]/10">
            <View className="absolute bottom-[-28px] right-[-18px] h-20 w-20 rounded-full bg-[#DDE8FF]/60" />
            <View className="mb-2 flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-full bg-[#346EF6]" />
              <Text className="text-[12px] font-black uppercase text-[#346EF6]">
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
              onPress={() => router.push('/register')}
              className={cx(
                'items-center justify-center rounded-full bg-[#346EF6] shadow-lg shadow-[#004BFA]/20',
                buttonHeightClass,
              )}>
              <Text className={primaryTextClass}>Register</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/login')}
              className={cx(
                'items-center justify-center rounded-full border border-[#346EF6]/20 bg-white',
                buttonHeightClass,
              )}>
              <Text className={secondaryTextClass}>Login</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const $carImage: ImageStyle = {
  height: '100%',
  width: '100%',
};
