import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const carHero = require('@/assets/images/vios-hero.png');

export default function LandingScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const frameWidth = Math.min(width, 430);
  const isCompact = height < 760;
  const heroWidth = Math.min(frameWidth * (isCompact ? 0.9 : 1.13), 480);
  const heroHeight = heroWidth * 0.64;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={[styles.screen, width > 520 && styles.webFrame]}>
        <View style={styles.blueGlow} />
        <View style={styles.warmGlow} />
        <View style={styles.gridLineTop} />
        <View style={styles.gridLineBottom} />

        <View style={styles.topBar}>
          <Text style={styles.brand}>JAMJADE</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Rent ready</Text>
          </View>
        </View>

        <View style={[styles.heroCopy, isCompact && styles.heroCopyCompact]}>
          <Text style={styles.eyebrow}>Premium car rental</Text>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>Your Journey</Text>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>starts with</Text>
          <Text style={[styles.title, styles.titleAccent, isCompact && styles.titleCompact]}>
            JamJade
          </Text>
        </View>

        <View style={[styles.carStage, isCompact && styles.carStageCompact]}>
          <View style={styles.carHalo} />
          <Image
            source={carHero}
            contentFit="cover"
            contentPosition="center"
            style={[
              styles.carImage,
              {
                width: heroWidth,
                height: heroHeight,
              },
            ]}
          />
        </View>

        <View style={[styles.bottomPanel, isCompact && styles.bottomPanelCompact]}>
          <Text style={[styles.description, isCompact && styles.descriptionCompact]}>
            Premium cars on demand. From city cruisers to weekend escapes, your JamJade ride
            awaits.
          </Text>

          <View style={[styles.buttonStack, isCompact && styles.buttonStackCompact]}>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={({ pressed }) => [
                styles.primaryButton,
                isCompact && styles.buttonCompact,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={({ pressed }) => [
                styles.secondaryButton,
                isCompact && styles.buttonCompact,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.secondaryButtonText}>I already have an account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8F3',
  },
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
  },
  webFrame: {
    marginVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(21, 31, 50, 0.08)',
    borderRadius: 36,
    backgroundColor: '#F6F8F3',
    shadowColor: '#151F32',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.14,
    shadowRadius: 42,
  },
  blueGlow: {
    position: 'absolute',
    top: 54,
    right: -110,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#DDE8FF',
    opacity: 0.95,
  },
  warmGlow: {
    position: 'absolute',
    top: -68,
    left: -84,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#EEF2D6',
    opacity: 0.95,
  },
  gridLineTop: {
    position: 'absolute',
    top: 122,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(23, 23, 23, 0.06)',
  },
  gridLineBottom: {
    position: 'absolute',
    bottom: 204,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(23, 23, 23, 0.06)',
  },
  topBar: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#346EF6',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(52, 110, 246, 0.18)',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#17315F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroCopy: {
    zIndex: 2,
    marginTop: 54,
  },
  heroCopyCompact: {
    marginTop: 24,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(52, 110, 246, 0.1)',
    color: '#346EF6',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#151F32',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-condensed',
      default: undefined,
    }),
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2.1,
    lineHeight: 56,
  },
  titleCompact: {
    fontSize: 40,
    lineHeight: 42,
  },
  titleAccent: {
    color: '#346EF6',
    fontStyle: 'italic',
    letterSpacing: -2.4,
  },
  carStage: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -24,
    marginTop: -4,
  },
  carStageCompact: {
    marginTop: -12,
  },
  carHalo: {
    position: 'absolute',
    bottom: 16,
    width: '82%',
    height: 74,
    borderRadius: 999,
    backgroundColor: 'rgba(21, 31, 50, 0.14)',
    transform: [{ scaleX: 1.08 }],
  },
  carImage: {
    borderRadius: 28,
    shadowColor: '#151F32',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
  },
  bottomPanel: {
    zIndex: 2,
    marginTop: 'auto',
  },
  bottomPanelCompact: {
    marginTop: 14,
  },
  description: {
    color: '#1A2233',
    fontSize: 18,
    lineHeight: 25,
    marginBottom: 28,
  },
  descriptionCompact: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 20,
  },
  buttonStack: {
    gap: 14,
  },
  buttonStackCompact: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#346EF6',
    shadowColor: '#004BFA',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 110, 246, 0.22)',
    borderRadius: 999,
    backgroundColor: '#DDE8FF',
  },
  buttonCompact: {
    minHeight: 54,
  },
  secondaryButtonText: {
    color: '#17315F',
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
