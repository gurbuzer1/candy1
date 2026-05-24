import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

export default function AchievementToast({ ach, onDone }) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(-30);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(2200, withTiming(0, { duration: 320 })),
    );
    ty.value = withSequence(
      withTiming(0, { duration: 240, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(2200, withTiming(-30, { duration: 320 }, (f) => {
        if (f && onDone) runOnJS(onDone)();
      })),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.toast, animStyle]}>
      <Text style={styles.icon}>🏆</Text>
      <View style={styles.text}>
        <Text style={styles.label}>Achievement Unlocked!</Text>
        <Text style={styles.name}>{ach.name}</Text>
        <Text style={styles.reward}>+🪙 {ach.reward}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 5, 40, 0.96)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#ffd700',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 1000,
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: '#ffd700',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  name: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '900',
    marginTop: 1,
  },
  reward: {
    fontSize: 11,
    color: '#b388ff',
    fontWeight: '700',
    marginTop: 1,
  },
});
