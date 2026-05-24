import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { CANDY_COLORS } from '../constants/game';

const COLOR_LABELS = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE'];

export default function ColorFrenzyOverlay({ colorType, count, onDone }) {
  const tintColor = CANDY_COLORS[colorType]?.bg || '#ff6bcb';
  const label = COLOR_LABELS[colorType] || 'COLOR';

  const tintOpacity = useSharedValue(0);
  const bannerScale = useSharedValue(0.6);
  const bannerOpacity = useSharedValue(0);

  useEffect(() => {
    tintOpacity.value = withSequence(
      withTiming(0.55, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withDelay(700, withTiming(0, { duration: 320 })),
    );
    bannerScale.value = withSequence(
      withTiming(1.18, { duration: 280, easing: Easing.out(Easing.back(1.8)) }),
      withTiming(1, { duration: 160 }),
      withDelay(440, withTiming(1.2, { duration: 280, easing: Easing.in(Easing.cubic) })),
    );
    bannerOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(700, withTiming(0, { duration: 280 }, (f) => {
        if (f && onDone) runOnJS(onDone)();
      })),
    );
  }, []);

  const tintStyle = useAnimatedStyle(() => ({ opacity: tintOpacity.value }));
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tintColor },
          tintStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.banner,
          { borderColor: tintColor, shadowColor: tintColor },
          bannerStyle,
        ]}
      >
        <Text style={[styles.label, { color: tintColor }]}>{label}</Text>
        <Text style={styles.title}>FRENZY!</Text>
        <Text style={styles.sub}>×{count} detonating</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
  },
  banner: {
    backgroundColor: 'rgba(15, 5, 35, 0.92)',
    paddingHorizontal: 44,
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 6,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
    marginTop: 4,
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  sub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b388ff',
    marginTop: 6,
    letterSpacing: 2,
  },
});
