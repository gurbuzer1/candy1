import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import {
  CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, SPECIAL, CANDY_COLORS,
} from '../constants/game';

export default function SpecialActivationFX({ activation, onDone }) {
  if (!activation) return null;
  if (activation.special === SPECIAL.STRIPED_H) {
    return <StripedBeam activation={activation} horizontal onDone={onDone} />;
  }
  if (activation.special === SPECIAL.STRIPED_V) {
    return <StripedBeam activation={activation} horizontal={false} onDone={onDone} />;
  }
  if (activation.special === SPECIAL.WRAPPED) {
    return <WrappedShock activation={activation} onDone={onDone} />;
  }
  if (activation.special === SPECIAL.COLOR_BOMB) {
    return <ColorBombFlash activation={activation} onDone={onDone} />;
  }
  return null;
}

function StripedBeam({ activation, horizontal, onDone }) {
  const opacity = useSharedValue(0);
  const stretch = useSharedValue(0.2);
  const tint = CANDY_COLORS[activation.type]?.bg || '#ffffff';

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 60, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 280, easing: Easing.in(Easing.cubic) }),
    );
    stretch.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }, (f) => {
      if (f && onDone) runOnJS(onDone)(activation.id);
    });
  }, []);

  const animStyle = useAnimatedStyle(() =>
    horizontal
      ? {
          opacity: opacity.value,
          transform: [{ scaleX: stretch.value }],
        }
      : {
          opacity: opacity.value,
          transform: [{ scaleY: stretch.value }],
        },
  );

  if (horizontal) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.beamH,
          {
            top: activation.row * CELL_SIZE + CELL_SIZE / 2 - 8,
            backgroundColor: tint,
            shadowColor: tint,
          },
          animStyle,
        ]}
      />
    );
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.beamV,
        {
          left: activation.col * CELL_SIZE + CELL_SIZE / 2 - 8,
          backgroundColor: tint,
          shadowColor: tint,
        },
        animStyle,
      ]}
    />
  );
}

function WrappedShock({ activation, onDone }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(1);
  const tint = CANDY_COLORS[activation.type]?.bg || '#ffffff';

  useEffect(() => {
    scale.value = withTiming(3.4, { duration: 420, easing: Easing.out(Easing.cubic) }, (f) => {
      if (f && onDone) runOnJS(onDone)(activation.id);
    });
    opacity.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const centerX = activation.col * CELL_SIZE + CELL_SIZE / 2;
  const centerY = activation.row * CELL_SIZE + CELL_SIZE / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shock,
        {
          left: centerX - CELL_SIZE,
          top: centerY - CELL_SIZE,
          borderColor: tint,
          shadowColor: tint,
        },
        animStyle,
      ]}
    />
  );
}

function ColorBombFlash({ activation, onDone }) {
  const flashOpacity = useSharedValue(0);
  const burstScale = useSharedValue(0.2);
  const burstOpacity = useSharedValue(1);

  useEffect(() => {
    flashOpacity.value = withSequence(
      withTiming(0.7, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) }),
    );
    burstScale.value = withTiming(5, { duration: 480, easing: Easing.out(Easing.cubic) }, (f) => {
      if (f && onDone) runOnJS(onDone)(activation.id);
    });
    burstOpacity.value = withDelay(60, withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }));
  }, []);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstScale.value }],
    opacity: burstOpacity.value,
  }));

  const centerX = activation.col * CELL_SIZE + CELL_SIZE / 2;
  const centerY = activation.row * CELL_SIZE + CELL_SIZE / 2;

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.bombFlash, flashStyle]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bombBurst,
          { left: centerX - CELL_SIZE, top: centerY - CELL_SIZE },
          burstStyle,
        ]}
      />
      {[0, 45, 90, 135].map((angle) => (
        <RadialLine key={angle} centerX={centerX} centerY={centerY} angle={angle} />
      ))}
    </>
  );
}

function RadialLine({ centerX, centerY, angle }) {
  const stretch = useSharedValue(0.1);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    stretch.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    opacity.value = withDelay(80, withTiming(0, { duration: 280 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${angle}deg` }, { scaleX: stretch.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.radialLine,
        {
          left: centerX - BOARD_WIDTH / 2,
          top: centerY - 2,
          width: BOARD_WIDTH,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  beamH: {
    position: 'absolute',
    left: 0,
    width: BOARD_WIDTH,
    height: 16,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    zIndex: 5,
  },
  beamV: {
    position: 'absolute',
    top: 0,
    width: 16,
    height: BOARD_HEIGHT,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    zIndex: 5,
  },
  shock: {
    position: 'absolute',
    width: CELL_SIZE * 2,
    height: CELL_SIZE * 2,
    borderRadius: CELL_SIZE,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    zIndex: 5,
  },
  bombFlash: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    backgroundColor: '#ffffff',
    zIndex: 6,
  },
  bombBurst: {
    position: 'absolute',
    width: CELL_SIZE * 2,
    height: CELL_SIZE * 2,
    borderRadius: CELL_SIZE,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    zIndex: 7,
  },
  radialLine: {
    position: 'absolute',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
    zIndex: 6,
  },
});
