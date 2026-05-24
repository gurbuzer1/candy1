import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import {
  CELL_SIZE, CANDY_SIZE, CANDY_BORDER_RADIUS,
  CANDY_COLORS, SPECIAL,
} from '../constants/game';

const SPRING_FALL = { damping: 14, stiffness: 170, mass: 0.7 };
const SPRING_MOVE = { damping: 18, stiffness: 230, mass: 0.5 };
const SPRING_SELECT = { damping: 10, stiffness: 220, mass: 0.5 };

function CandyCell({ candy, col, row, isSelected, isRemoving, onRemoved }) {
  const colors = CANDY_COLORS[candy.type];
  const isColorBomb = candy.special === SPECIAL.COLOR_BOMB;

  const baseLeft = col * CELL_SIZE + (CELL_SIZE - CANDY_SIZE) / 2;
  const baseTop = row * CELL_SIZE + (CELL_SIZE - CANDY_SIZE) / 2;

  // Position offset relative to base (animates to 0 after grid changes).
  const tx = useSharedValue(0);
  const ty = useSharedValue(-CELL_SIZE * (row + 1.5));

  // Life-cycle scale: 0 on removal, 1 active. Multiplied with selection scale.
  const scaleLife = useSharedValue(1);
  const scaleSelect = useSharedValue(1);
  const opacity = useSharedValue(1);

  const prevColRef = useRef(col);
  const prevRowRef = useRef(row);
  const isFirstMountRef = useRef(true);

  // Entrance + position-change animation.
  useEffect(() => {
    if (isFirstMountRef.current) {
      ty.value = withSpring(0, SPRING_FALL);
      isFirstMountRef.current = false;
    } else {
      const dCol = col - prevColRef.current;
      const dRow = row - prevRowRef.current;
      if (dCol !== 0 || dRow !== 0) {
        tx.value = tx.value - dCol * CELL_SIZE;
        ty.value = ty.value - dRow * CELL_SIZE;
        tx.value = withSpring(0, SPRING_MOVE);
        ty.value = withSpring(0, dRow > 0 ? SPRING_FALL : SPRING_MOVE);
      }
    }
    prevColRef.current = col;
    prevRowRef.current = row;
  }, [col, row]);

  // Selection pop.
  useEffect(() => {
    scaleSelect.value = withSpring(isSelected ? 1.14 : 1, SPRING_SELECT);
  }, [isSelected]);

  // Removal pop-then-shrink.
  useEffect(() => {
    if (isRemoving) {
      scaleLife.value = withSequence(
        withTiming(1.28, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }),
      );
      opacity.value = withDelay(
        90,
        withTiming(0, { duration: 180 }, (finished) => {
          if (finished && onRemoved) runOnJS(onRemoved)(candy.id);
        }),
      );
    }
  }, [isRemoving]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scaleLife.value * scaleSelect.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { left: baseLeft, top: baseTop },
        animStyle,
      ]}
    >
      {isColorBomb ? (
        <ColorBombCandy />
      ) : (
        <RegularCandy colors={colors} special={candy.special} />
      )}
    </Animated.View>
  );
}

function RegularCandy({ colors, special }) {
  return (
    <View
      style={[
        styles.candy,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          shadowColor: colors.bg,
        },
      ]}
    >
      <View style={[styles.highlight, { backgroundColor: colors.highlight }]} />
      <View style={styles.shineDot} />
      {special === SPECIAL.STRIPED_H && <StripedOverlay horizontal />}
      {special === SPECIAL.STRIPED_V && <StripedOverlay horizontal={false} />}
      {special === SPECIAL.WRAPPED && <WrappedOverlay />}
    </View>
  );
}

function StripedOverlay({ horizontal }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {[-2, -1, 0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.stripe,
            horizontal
              ? { top: CANDY_SIZE / 2 + i * 5 - 1, left: 3, right: 3, height: 2 }
              : { left: CANDY_SIZE / 2 + i * 5 - 1, top: 3, bottom: 3, width: 2 },
          ]}
        />
      ))}
    </View>
  );
}

function WrappedOverlay() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.wrappedInner} />
      <View style={[styles.wrappedDot, { top: 5, left: 5 }]} />
      <View style={[styles.wrappedDot, { top: 5, right: 5 }]} />
      <View style={[styles.wrappedDot, { bottom: 5, left: 5 }]} />
      <View style={[styles.wrappedDot, { bottom: 5, right: 5 }]} />
    </View>
  );
}

function ColorBombCandy() {
  const segments = ['#ff4757', '#ffa502', '#ffd32a', '#2ed573', '#1e90ff', '#a855f7'];
  return (
    <View style={styles.colorBomb}>
      {segments.map((color, i) => (
        <View
          key={i}
          style={[
            styles.colorSegment,
            { backgroundColor: color, transform: [{ rotate: `${i * 60}deg` }] },
          ]}
        />
      ))}
      <View style={styles.colorBombCenter} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: CANDY_SIZE,
    height: CANDY_SIZE,
    zIndex: 2,
  },
  candy: {
    width: CANDY_SIZE,
    height: CANDY_SIZE,
    borderRadius: CANDY_BORDER_RADIUS,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  highlight: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: CANDY_SIZE * 0.55,
    height: CANDY_SIZE * 0.28,
    borderRadius: CANDY_SIZE * 0.2,
    opacity: 0.45,
  },
  shineDot: {
    position: 'absolute',
    top: 5,
    left: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  stripe: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1,
  },
  wrappedInner: {
    position: 'absolute',
    top: CANDY_SIZE * 0.22,
    left: CANDY_SIZE * 0.22,
    right: CANDY_SIZE * 0.22,
    bottom: CANDY_SIZE * 0.22,
    borderRadius: CANDY_BORDER_RADIUS * 0.5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  wrappedDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  colorBomb: {
    width: CANDY_SIZE,
    height: CANDY_SIZE,
    borderRadius: CANDY_SIZE / 2,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  colorSegment: {
    position: 'absolute',
    width: CANDY_SIZE * 0.35,
    height: CANDY_SIZE * 0.12,
    borderRadius: 2,
    opacity: 0.7,
  },
  colorBombCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    zIndex: 1,
  },
});

export default React.memo(CandyCell);
