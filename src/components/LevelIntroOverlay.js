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

export default function LevelIntroOverlay({ levelNum, onDone }) {
  const tx = useSharedValue(-220);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    tx.value = withSequence(
      withTiming(0, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
      withDelay(720, withTiming(220, { duration: 320, easing: Easing.in(Easing.cubic) })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(820, withTiming(0, { duration: 280 }, (f) => {
        if (f && onDone) runOnJS(onDone)();
      })),
    );
    scale.value = withSequence(
      withTiming(1.08, { duration: 320, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 140 }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.banner, animStyle]}>
        <Text style={styles.label}>LEVEL</Text>
        <Text style={styles.num}>{levelNum}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  banner: {
    backgroundColor: 'rgba(20, 5, 40, 0.92)',
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd700',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 14,
  },
  label: {
    fontSize: 14,
    color: '#b388ff',
    fontWeight: '800',
    letterSpacing: 5,
  },
  num: {
    fontSize: 64,
    color: '#ffd700',
    fontWeight: '900',
    lineHeight: 68,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
