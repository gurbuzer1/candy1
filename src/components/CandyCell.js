import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { CANDY_SIZE, CANDY_BORDER_RADIUS, CANDY_COLORS, SPECIAL } from '../constants/game';

const SPRING_CONFIG = { damping: 12, stiffness: 180, mass: 0.8 };

function CandyCell({ candy, animatedX, animatedY, animatedScale, animatedOpacity }) {
  if (!candy) return null;

  const colors = CANDY_COLORS[candy.type];
  const isColorBomb = candy.special === SPECIAL.COLOR_BOMB;

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animatedX.value },
      { translateY: animatedY.value },
      { scale: animatedScale.value },
    ],
    opacity: animatedOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
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
    <View style={[styles.candy, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {/* Highlight */}
      <View style={[styles.highlight, { backgroundColor: colors.highlight }]} />

      {/* Shine dot */}
      <View style={styles.shineDot} />

      {/* Special overlays */}
      {(special === SPECIAL.STRIPED_H) && <StripedOverlay horizontal />}
      {(special === SPECIAL.STRIPED_V) && <StripedOverlay horizontal={false} />}
      {(special === SPECIAL.WRAPPED) && <WrappedOverlay />}
    </View>
  );
}

function StripedOverlay({ horizontal }) {
  const stripes = [-2, -1, 0, 1, 2];
  return (
    <View style={styles.overlayContainer}>
      {stripes.map((i) => (
        <View
          key={i}
          style={[
            styles.stripe,
            horizontal
              ? { top: CANDY_SIZE / 2 + i * 5 - 1, left: 4, right: 4, height: 2 }
              : { left: CANDY_SIZE / 2 + i * 5 - 1, top: 4, bottom: 4, width: 2 },
          ]}
        />
      ))}
    </View>
  );
}

function WrappedOverlay() {
  return (
    <View style={styles.overlayContainer}>
      <View style={styles.wrappedInner} />
      <View style={[styles.wrappedDot, { top: 6, left: 6 }]} />
      <View style={[styles.wrappedDot, { top: 6, right: 6 }]} />
      <View style={[styles.wrappedDot, { bottom: 6, left: 6 }]} />
      <View style={[styles.wrappedDot, { bottom: 6, right: 6 }]} />
    </View>
  );
}

function ColorBombCandy() {
  const segments = ['#ff4757', '#ffa502', '#ffd32a', '#2ed573', '#1e90ff', '#a855f7'];
  return (
    <View style={styles.colorBomb}>
      <View style={styles.colorBombInner}>
        {segments.map((color, i) => (
          <View
            key={i}
            style={[
              styles.colorSegment,
              {
                backgroundColor: color,
                transform: [{ rotate: `${i * 60}deg` }],
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.colorBombCenter} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: CANDY_SIZE,
    height: CANDY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  candy: {
    width: CANDY_SIZE,
    height: CANDY_SIZE,
    borderRadius: CANDY_BORDER_RADIUS,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  highlight: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: CANDY_SIZE * 0.55,
    height: CANDY_SIZE * 0.3,
    borderRadius: CANDY_SIZE * 0.2,
    opacity: 0.4,
  },
  shineDot: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
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
    borderRadius: CANDY_BORDER_RADIUS * 0.6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  wrappedDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  colorBombInner: {
    width: CANDY_SIZE * 0.8,
    height: CANDY_SIZE * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSegment: {
    position: 'absolute',
    width: CANDY_SIZE * 0.35,
    height: CANDY_SIZE * 0.15,
    borderRadius: 2,
    opacity: 0.7,
    left: CANDY_SIZE * 0.22,
    top: CANDY_SIZE * 0.32,
    transformOrigin: 'left center',
  },
  colorBombCenter: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
});

export default React.memo(CandyCell);
