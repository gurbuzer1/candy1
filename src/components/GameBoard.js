import React, { useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import {
  COLS, ROWS, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, THEME,
} from '../constants/game';
import CandyCell from './CandyCell';
import SpecialActivationFX from './SpecialActivationFX';
import ScorePopup from './ScorePopup';

const EMPTY_SET = new Set();
const EMPTY_ARR = [];

export default function GameBoard({
  grid,
  selectedCell,
  hintCell,
  removingIds = EMPTY_SET,
  activations = EMPTY_ARR,
  scorePopups = EMPTY_ARR,
  onActivationDone,
  onPopupDone,
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
          <BoardBackground />

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

          {grid.map((col, c) =>
            col.map((candy, r) => {
              if (!candy) return null;
              const isSelected =
                selectedCell &&
                selectedCell.col === c &&
                selectedCell.row === r;
              return (
                <CandyCell
                  key={candy.id}
                  candy={candy}
                  col={c}
                  row={r}
                  isSelected={!!isSelected}
                  isRemoving={removingIds.has(candy.id)}
                />
              );
            }),
          )}

          {/* Special activation FX (beams / shock rings / flash) */}
          {activations.map((a) => (
            <SpecialActivationFX
              key={a.id}
              activation={a}
              onDone={onActivationDone}
            />
          ))}

          {/* Score popups */}
          {scorePopups.map((p) => (
            <ScorePopup
              key={p.id}
              score={p.score}
              x={p.x}
              y={p.y}
              color={p.color}
              onDone={() => onPopupDone && onPopupDone(p.id)}
            />
          ))}
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
        />,
      );
    }
  }
  return <>{cells}</>;
});

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
    overflow: 'hidden',
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
});
