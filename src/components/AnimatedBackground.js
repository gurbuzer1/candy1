import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const PARTICLES = [
  { l: '8%',  t: '6%',  size: 10, color: 'rgba(255, 107, 203, 0.18)', dx:  46, dy:  62, dur: 13000, dly:    0 },
  { l: '72%', t: '4%',  size: 14, color: 'rgba(168, 85, 247, 0.15)',  dx: -54, dy:  44, dur: 15500, dly:  800 },
  { l: '22%', t: '20%', size:  6, color: 'rgba(255, 215,   0, 0.16)', dx:  38, dy: -28, dur: 11000, dly: 1500 },
  { l: '90%', t: '24%', size:  9, color: 'rgba(46, 213, 115, 0.14)',  dx: -42, dy: -36, dur: 14000, dly:  500 },
  { l: '14%', t: '46%', size: 12, color: 'rgba(30, 144, 255, 0.14)',  dx:  60, dy:  30, dur: 16500, dly: 2200 },
  { l: '46%', t: '38%', size:  7, color: 'rgba(255, 165,   2, 0.16)', dx: -34, dy: -50, dur: 12500, dly:    0 },
  { l: '78%', t: '54%', size: 11, color: 'rgba(255, 107, 203, 0.13)', dx:  48, dy:  38, dur: 14500, dly: 1800 },
  { l: '6%',  t: '70%', size:  8, color: 'rgba(168, 85, 247, 0.16)',  dx:  44, dy: -42, dur: 13500, dly:  600 },
  { l: '36%', t: '62%', size: 13, color: 'rgba(255, 71,  87, 0.14)',  dx: -52, dy:  48, dur: 17000, dly: 2600 },
  { l: '62%', t: '78%', size:  9, color: 'rgba(46, 213, 115, 0.16)',  dx:  40, dy: -34, dur: 12000, dly: 1100 },
  { l: '88%', t: '82%', size:  6, color: 'rgba(255, 215,   0, 0.18)', dx: -48, dy: -28, dur: 13800, dly:  300 },
  { l: '18%', t: '90%', size: 11, color: 'rgba(30, 144, 255, 0.13)',  dx:  56, dy: -40, dur: 16000, dly: 2000 },
];

export default function AnimatedBackground({ style }) {
  return (
    <View style={[styles.layer, style]} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}
    </View>
  );
}

function Particle({ l, t, size, color, dx, dy, dur, dly }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    tx.value = withDelay(
      dly,
      withRepeat(
        withTiming(dx, { duration: dur, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      ),
    );
    ty.value = withDelay(
      dly + 400,
      withRepeat(
        withTiming(dy, { duration: dur * 1.15, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      ),
    );
    opacity.value = withDelay(
      dly + 200,
      withRepeat(
        withTiming(1, { duration: dur * 0.6, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: l,
          top: t,
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
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
});
