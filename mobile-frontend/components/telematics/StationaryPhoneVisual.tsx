import { CircleCheck } from 'lucide-react-native';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { themeColors as colors } from '@/constants/theme';

export function StationaryPhoneVisual({ guideSize, marginVertical = 0, progress, color, passed, pulse }: {
  guideSize: number;
  marginVertical?: number;
  progress: number;
  color: string;
  passed: boolean;
  pulse?: Animated.Value;
}) {
  return (
    <View style={[styles.guide, { width: guideSize, height: guideSize, marginVertical }]} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.artwork, { transform: [{ scale: guideSize / 248 }] }]}><Svg width="100%" height="100%" viewBox="0 0 248 248" style={StyleSheet.absoluteFill}>
          <Circle cx={124} cy={124} r={111} fill={colors.background} stroke={colors.border} strokeWidth={1} />
          <Circle cx={124} cy={124} r={103} fill="none" stroke={colors.border} strokeWidth={5} />
          <Circle cx={124} cy={124} r={103} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 103}`} strokeDashoffset={2 * Math.PI * 103 * (1 - progress)} rotation={-90} origin="124, 124" />
        </Svg>
        <View style={styles.mountStem} /><View style={styles.mountBase} />
        <View style={styles.phone}>
          <View style={styles.notch} />
          <View style={[styles.phoneScreen, { borderColor: color }]}>
            {passed ? <Animated.View style={{ opacity: pulse ?? 1, transform: [{ scale: pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1 }] }}><CircleCheck size={40} color={colors.success} strokeWidth={1.6} /></Animated.View> : <>
              <View style={[styles.crosshairHorizontal, { backgroundColor: color }]} /><View style={[styles.crosshairVertical, { backgroundColor: color }]} />
              <Animated.View style={[styles.target, { borderColor: color, opacity: pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) : 1, transform: [{ scale: pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] }) : 1 }] }]} />
              <View style={[styles.targetDot, { backgroundColor: color }]} />
            </>}
          </View>
          <View style={styles.homeIndicator} />
        </View>
        <View style={styles.mountGrip} /></View>
      </View>
  );
}

const styles = StyleSheet.create({
  guide: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  artwork: { width: 248, height: 248, alignItems: 'center', justifyContent: 'center' },
  phone: { width: 78, height: 142, borderRadius: 17, borderWidth: 3, borderColor: colors.foreground, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: -10 },
  phoneScreen: { width: 62, height: 108, borderRadius: 10, borderWidth: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  notch: { position: 'absolute', zIndex: 1, width: 25, height: 4, borderRadius: 4, top: 5, backgroundColor: colors.foreground },
  homeIndicator: { position: 'absolute', bottom: 4, width: 22, height: 3, borderRadius: 3, backgroundColor: colors.foreground },
  mountStem: { position: 'absolute', width: 12, height: 43, bottom: 41, borderRadius: 5, backgroundColor: colors.subtleForeground },
  mountBase: { position: 'absolute', width: 94, height: 10, bottom: 37, borderRadius: 6, backgroundColor: colors.foreground },
  mountGrip: { position: 'absolute', width: 96, height: 16, top: 141, borderWidth: 3, borderColor: colors.foreground, borderRadius: 6, backgroundColor: colors.surface },
  crosshairHorizontal: { position: 'absolute', width: 42, height: 1, opacity: 0.25 },
  crosshairVertical: { position: 'absolute', width: 1, height: 42, opacity: 0.25 },
  target: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5 },
  targetDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4 },
});
