import React, { useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
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
  COLS, ROWS, CELL_SIZE, CANDY_SIZE, BOARD_WIDTH, BOARD_HEIGHT,
  CANDY_COLORS, CANDY_BORDER_RADIUS, SPECIAL, THEME,
  SWAP_DURATION, FALL_DURATION, REMOVE_DURATION,
} from '../constants/game';

const SPRING_CONF = { damping: 14, stiffness: 200, mass: 0.6 };

export default function GameBoard({
  grid,
  selectedCell,
  hintCell,
  onCellTap,
  onSwipe,
  disabled,
}) {
  const startRef = useRef({ x: 0, y: 0 });
  const hasSwiped = useRef(false);

  const getCellFromPos = useCallback((x, y) => {
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      return { col, row };
    }
    return null;
  }, []);

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      startRef.current = { x: e.x, y: e.y };
      hasSwiped.current = false;
    })
    .onUpdate((e) => {
      if (hasSwiped.current || disabled) return;
      const dx = e.x - startRef.current.x;
      const dy = e.y - startRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= 20) {
        hasSwiped.current = true;
        const cell = getCellFromPos(startRef.current.x, startRef.current.y);
        if (cell) {
          let dirCol = 0, dirRow = 0;
          if (Math.abs(dx) > Math.abs(dy)) {
            dirCol = dx > 0 ? 1 : -1;
          } else {
            dirRow = dy > 0 ? 1 : -1;
          }
          runOnJS(onSwipe)(cell.col, cell.row, dirCol, dirRow);
        }
      }
    })
    .onEnd(() => {
      if (!hasSwiped.current && !disabled) {
        const cell = getCellFromPos(startRef.current.x, startRef.current.y);
        if (cell) {
          runOnJS(onCellTap)(cell.col, cell.row);
        }
      }
    });

  return (
    <View style={styles.boardWrapper}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.board}>
          {/* Checkerboard background */}
          <BoardBackground />

          {/* Selection highlight */}
          {selectedCell && (
            <View
              style={[
                styles.selectionHighlight,
                {
                  left: selectedCell.col * CELL_SIZE,
                  top: selectedCell.row * CELL_SIZE,
                },
              ]}
            />
          )}

          {/* Hint highlight */}
          {hintCell && (
            <View
              style={[
                styles.hintHighlight,
                {
                  left: hintCell.col * CELL_SIZE,
                  top: hintCell.row * CELL_SIZE,
                },
              ]}
            />
          )}

          {/* Candies */}
          {grid.map((col, c) =>
            col.map((candy, r) => {
              if (!candy) return null;
              return (
                <CandyView
                  key={candy.id}
                  candy={candy}
                  col={c}
                  row={r}
                  isSelected={
                    selectedCell &&
                    selectedCell.col === c &&
                    selectedCell.row === r
                  }
                />
              );
            })
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const BoardBackground = React.memo(function BoardBackground() {
  const cells = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      cells.push(
        <View
          key={`bg_${c}_${r}`}
          style={[
            styles.bgCell,
            {
              left: c * CELL_SIZE,
              top: r * CELL_SIZE,
              backgroundColor:
                (c + r) % 2 === 0 ? THEME.cellLight : THEME.cellDark,
            },
          ]}
        />
      );
    }
  }
  return <>{cells}</>;
});

function CandyView({ candy, col, row, isSelected }) {
  const colors = CANDY_COLORS[candy.type];
  const isColorBomb = candy.special === SPECIAL.COLOR_BOMB;

  const x = col * CELL_SIZE + (CELL_SIZE - CANDY_SIZE) / 2;
  const y = row * CELL_SIZE + (CELL_SIZE - CANDY_SIZE) / 2;

  return (
    <View
      style={[
        styles.candyContainer,
        {
          left: x,
          top: y,
          transform: isSelected ? [{ scale: 1.12 }] : [{ scale: 1 }],
        },
      ]}
    >
      {isColorBomb ? (
        <View style={styles.colorBomb}>
          <View style={[styles.colorSegment, { backgroundColor: '#ff4757', transform: [{ rotate: '0deg' }] }]} />
          <View style={[styles.colorSegment, { backgroundColor: '#ffa502', transform: [{ rotate: '60deg' }] }]} />
          <View style={[styles.colorSegment, { backgroundColor: '#ffd32a', transform: [{ rotate: '120deg' }] }]} />
          <View style={[styles.colorSegment, { backgroundColor: '#2ed573', transform: [{ rotate: '180deg' }] }]} />
          <View style={[styles.colorSegment, { backgroundColor: '#1e90ff', transform: [{ rotate: '240deg' }] }]} />
          <View style={[styles.colorSegment, { backgroundColor: '#a855f7', transform: [{ rotate: '300deg' }] }]} />
          <View style={styles.colorBombCenter} />
        </View>
      ) : (
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

          {candy.special === SPECIAL.STRIPED_H && <StripedOverlay horizontal />}
          {candy.special === SPECIAL.STRIPED_V && <StripedOverlay horizontal={false} />}
          {candy.special === SPECIAL.WRAPPED && <WrappedOverlay />}
        </View>
      )}
    </View>
  );
}

function StripedOverlay({ horizontal }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {[-2, -1, 0, 1, 2].map(i => (
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

const styles = StyleSheet.create({
  boardWrapper: {
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: THEME.boardBg,
    padding: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  board: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    position: 'relative',
  },
  bgCell: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  selectionHighlight: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    zIndex: 1,
  },
  hintHighlight: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    zIndex: 1,
  },
  candyContainer: {
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
