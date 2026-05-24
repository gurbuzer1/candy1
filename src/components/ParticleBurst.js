import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const COUNT = 7;
const DISTANCE = 38;
const DURATION_MS = 540;

export default function ParticleBurst({ id, x, y, color, onDone }) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { left: x, top: y }]}>
      {Array.from({ length: COUNT }, (_, i) => (
        <Particle
          key={i}
          index={i}
          color={color}
          last={i === COUNT - 1}
          onLastDone={() => onDone && onDone(id)}
        />
      ))}
    </View>
  );
}

function Particle({ index, color, last, onLastDone }) {
  // Even angular spread plus a small jitter so it doesn't look mechanical.
  const baseAngle = (index / COUNT) * Math.PI * 2;
  const jitter = ((index * 7919) % 100 - 50) / 100 * 0.35;
  const angle = baseAngle + jitter;
  const dist = DISTANCE * (0.7 + ((index * 1013) % 100) / 100 * 0.55);
  const targetX = Math.cos(angle) * dist;
  const targetY = Math.sin(angle) * dist;
  const size = 4 + ((index * 1297) % 100) / 100 * 4;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    tx.value = withTiming(targetX, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(targetY, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: DURATION_MS, easing: Easing.in(Easing.cubic) }, (f) => {
      if (f && last && onLastDone) runOnJS(onLastDone)();
    });
    scale.value = withTiming(0.4, { duration: DURATION_MS, easing: Easing.in(Easing.cubic) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          shadowColor: color,
        },
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 0,
    height: 0,
    zIndex: 4,
  },
  dot: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
});
