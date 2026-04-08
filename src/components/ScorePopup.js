import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

export default function ScorePopup({ score, x, y, color = '#fff', onDone }) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.3, { duration: 150, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 100 })
    );
    translateY.value = withTiming(-60, { duration: 800, easing: Easing.out(Easing.quad) });
    opacity.value = withTiming(0, { duration: 800, easing: Easing.in(Easing.quad) }, () => {
      if (onDone) runOnJS(onDone)();
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x },
      { translateY: y + translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.popup, { color }, animStyle]}>
      +{score}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
