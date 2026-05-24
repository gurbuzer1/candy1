import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
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

  const tx = useSharedValue(0);
  const ty = useSharedValue(-CELL_SIZE * (row + 1.5));
  const scaleLife = useSharedValue(1);
  const scaleSelect = useSharedValue(1);
  const opacity = useSharedValue(1);
  const haloOpacity = useSharedValue(0);
  const haloScale = useSharedValue(1);

  const prevColRef = useRef(col);
  const prevRowRef = useRef(row);
  const isFirstMountRef = useRef(true);

  // Entrance + position-change
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

  // Selection: scale pulse + halo
  useEffect(() => {
    if (isSelected) {
      scaleSelect.value = withRepeat(
        withSequence(
          withTiming(1.16, { duration: 380, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1.06, { duration: 380, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        true,
      );
      haloOpacity.value = withTiming(0.55, { duration: 200 });
      haloScale.value = withRepeat(
        withSequence(
          withTiming(1.45, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        true,
      );
    } else {
      scaleSelect.value = withSpring(1, SPRING_SELECT);
      haloOpacity.value = withTiming(0, { duration: 180 });
      haloScale.value = withTiming(1, { duration: 180 });
    }
  }, [isSelected]);

  // Removal
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

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: haloScale.value }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            left: baseLeft - CANDY_SIZE * 0.2,
            top: baseTop - CANDY_SIZE * 0.2,
            backgroundColor: colors?.glow || 'rgba(255,255,255,0.4)',
            shadowColor: colors?.bg || '#fff',
          },
          haloStyle,
        ]}
      />
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
    </>
  );
}

function RegularCandy({ colors, special }) {
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (special === SPECIAL.WRAPPED) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0.97, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        true,
      );
    }
  }, [special]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const inner = (
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
      <SignatureIcon shape={colors.shape} />
      {special === SPECIAL.STRIPED_H && <StripedOverlay horizontal />}
      {special === SPECIAL.STRIPED_V && <StripedOverlay horizontal={false} />}
      {special === SPECIAL.WRAPPED && <WrappedOverlay />}
    </View>
  );

  if (special === SPECIAL.WRAPPED) {
    return <Animated.View style={breatheStyle}>{inner}</Animated.View>;
  }
  return inner;
}

// Per-color signature shape — gives instant recognition without changing footprint.
const ICON_SIZE = CANDY_SIZE * 0.4;
function SignatureIcon({ shape }) {
  // Centered slightly below the highlight band for visual balance.
  const center = { top: CANDY_SIZE * 0.45, alignItems: 'center', justifyContent: 'center' };
  switch (shape) {
    case 'circle':
      return (
        <View style={[styles.iconWrap, center]}>
          <View style={[styles.iconCircle]} />
        </View>
      );
    case 'diamond':
      return (
        <View style={[styles.iconWrap, center]}>
          <View style={[styles.iconDiamond]} />
        </View>
      );
    case 'square':
      return (
        <View style={[styles.iconWrap, center]}>
          <View style={[styles.iconSquare]} />
        </View>
      );
    case 'triangle':
      return (
        <View style={[styles.iconWrap, center]}>
          <View style={styles.iconTriangle} />
        </View>
      );
    case 'hexagon':
      // approximate with a plus sign for clarity at small sizes
      return (
        <View style={[styles.iconWrap, center]}>
          <View style={styles.iconPlusH} />
          <View style={styles.iconPlusV} />
        </View>
      );
    case 'star':
      return (
        <View style={[styles.iconWrap, center]}>
          <Text style={styles.iconStar}>★</Text>
        </View>
      );
    default:
      return null;
  }
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
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 4200, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={styles.colorBomb}>
      <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }, style]}>
        {segments.map((color, i) => (
          <View
            key={i}
            style={[
              styles.colorSegment,
              { backgroundColor: color, transform: [{ rotate: `${i * 60}deg` }] },
            ]}
          />
        ))}
      </Animated.View>
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
  halo: {
    position: 'absolute',
    width: CANDY_SIZE * 1.4,
    height: CANDY_SIZE * 1.4,
    borderRadius: CANDY_SIZE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    zIndex: 1,
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
  iconWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    transform: [{ translateY: -ICON_SIZE / 2 }],
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  iconDiamond: {
    width: ICON_SIZE * 0.8,
    height: ICON_SIZE * 0.8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    transform: [{ rotate: '45deg' }],
  },
  iconSquare: {
    width: ICON_SIZE * 0.78,
    height: ICON_SIZE * 0.78,
    borderRadius: ICON_SIZE * 0.18,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  iconTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: ICON_SIZE * 0.55,
    borderRightWidth: ICON_SIZE * 0.55,
    borderBottomWidth: ICON_SIZE * 0.95,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.85)',
  },
  iconPlusH: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE * 0.32,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
  },
  iconPlusV: {
    position: 'absolute',
    width: ICON_SIZE * 0.32,
    height: ICON_SIZE,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
  },
  iconStar: {
    fontSize: ICON_SIZE * 1.15,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    lineHeight: ICON_SIZE * 1.15,
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
