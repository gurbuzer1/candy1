import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLS, ROWS, CELL_SIZE, THEME, CANDY_COLORS, SPECIAL,
} from '../constants/game';
import { LEVELS } from '../constants/levels';
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  calculateScore, hasValidMoves, findHint, shuffleBoard,
} from '../engine/BoardEngine';
import { computeStars, saveProgress } from '../utils/storage';
import { tapHaptic, matchHaptic, specialHaptic, errorHaptic } from '../utils/haptics';
import GameBoard from '../components/GameBoard';
import ProgressBar from '../components/ProgressBar';

const CASCADE_LABELS = ['', 'Sweet!', 'Tasty!', 'Delicious!', 'Sugar Rush!', 'INCREDIBLE!'];
const CASCADE_COLORS = ['', '#ffd700', '#ff6bcb', '#ff4757', '#a855f7', '#00ff88'];

export default function GameScreen({ levelNum, progress, onComplete, onBack }) {
  const levelConfig = LEVELS[levelNum - 1];

  const [grid, setGrid] = useState(() => initBoard());
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(levelConfig.moves);
  const [selectedCell, setSelectedCell] = useState(null);
  const [hintCell, setHintCell] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cascadeLabel, setCascadeLabel] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [earnedStars, setEarnedStars] = useState(0);

  const scoreRef = useRef(0);
  const movesRef = useRef(levelConfig.moves);
  const hintTimerRef = useRef(null);

  function initBoard() {
    let board = createBoard();
    let safety = 0;
    while (findMatches(board).matched.size > 0 && safety < 100) {
      board = createBoard();
      safety++;
    }
    return board;
  }

  // Hint timer
  useEffect(() => {
    resetHintTimer();
    return () => clearTimeout(hintTimerRef.current);
  }, [grid]);

  function resetHintTimer() {
    clearTimeout(hintTimerRef.current);
    setHintCell(null);
    hintTimerRef.current = setTimeout(() => {
      const hint = findHint(grid);
      setHintCell(hint);
    }, 5000);
  }

  const handleCellTap = useCallback((col, row) => {
    if (busy) return;

    if (!selectedCell) {
      setSelectedCell({ col, row });
      tapHaptic();
      resetHintTimer();
    } else {
      const dc = Math.abs(col - selectedCell.col);
      const dr = Math.abs(row - selectedCell.row);

      if (dc + dr === 1) {
        trySwap(selectedCell.col, selectedCell.row, col, row);
      } else {
        setSelectedCell({ col, row });
        tapHaptic();
      }
      resetHintTimer();
    }
  }, [selectedCell, busy, grid]);

  const handleSwipe = useCallback((col, row, dirCol, dirRow) => {
    if (busy) return;

    const targetCol = col + dirCol;
    const targetRow = row + dirRow;

    if (targetCol >= 0 && targetCol < COLS && targetRow >= 0 && targetRow < ROWS) {
      trySwap(col, row, targetCol, targetRow);
    }
  }, [busy, grid]);

  async function trySwap(c1, r1, c2, r2) {
    setBusy(true);
    setSelectedCell(null);
    setHintCell(null);

    const swapped = swapCells(grid, c1, r1, c2, r2);
    const { matched, matchGroups } = findMatches(swapped);

    if (matched.size > 0) {
      tapHaptic();
      setGrid(swapped);

      // Consume a move
      const newMoves = movesRef.current - 1;
      movesRef.current = newMoves;
      setMovesLeft(newMoves);

      // Process cascading matches
      await delay(200);
      await processCascade(swapped, 0);
    } else {
      // Invalid swap - flash and revert
      errorHaptic();
      setGrid(swapped);
      await delay(200);
      setGrid(grid); // revert
      await delay(150);
      setBusy(false);
    }
  }

  async function processCascade(currentGrid, cascadeLevel) {
    const { matched, matchGroups } = findMatches(currentGrid);

    if (matched.size === 0) {
      // Done cascading
      setCascadeLabel('');

      // Check for valid moves
      if (!hasValidMoves(currentGrid)) {
        const shuffled = shuffleBoard(currentGrid);
        setGrid(shuffled);
        await delay(500);
        setBusy(false);
        return;
      }

      // Check end conditions
      checkEndConditions(currentGrid);
      return;
    }

    // Show cascade label
    if (cascadeLevel > 0) {
      const labelIdx = Math.min(cascadeLevel, CASCADE_LABELS.length - 1);
      setCascadeLabel(CASCADE_LABELS[labelIdx]);
    }

    // Calculate specials
    const specials = determineSpecials(matchGroups);

    // Get special removals
    const extraRemovals = getSpecialRemovals(currentGrid, matched);
    extraRemovals.forEach(key => matched.add(key));

    // Score
    const points = calculateScore(matchGroups, specials, cascadeLevel);
    const newScore = scoreRef.current + points;
    scoreRef.current = newScore;
    setScore(newScore);

    matchHaptic();
    if (specials.length > 0) specialHaptic();

    // Remove and collapse
    await delay(150);
    let { grid: collapsed } = removeAndCollapse(currentGrid, matched);

    // Place specials
    if (specials.length > 0) {
      collapsed = placeSpecials(collapsed, specials);
    }

    setGrid(collapsed);
    await delay(300);

    // Continue cascade
    await processCascade(collapsed, cascadeLevel + 1);
  }

  function checkEndConditions(currentGrid) {
    const currentScore = scoreRef.current;
    const currentMoves = movesRef.current;

    if (currentMoves <= 0) {
      if (currentScore >= levelConfig.target1) {
        // Won!
        const stars = computeStars(currentScore, levelConfig);
        setEarnedStars(stars);

        // Update progress
        const newProgress = { ...progress };
        const prevStars = newProgress.stars[levelNum] || 0;
        if (stars > prevStars) newProgress.stars[levelNum] = stars;
        const prevHigh = newProgress.highScores?.[levelNum] || 0;
        if (currentScore > prevHigh) {
          if (!newProgress.highScores) newProgress.highScores = {};
          newProgress.highScores[levelNum] = currentScore;
        }
        if (levelNum >= newProgress.maxLevel && levelNum < LEVELS.length) {
          newProgress.maxLevel = levelNum + 1;
        }
        saveProgress(newProgress);

        setTimeout(() => setShowComplete(true), 400);
      } else {
        setTimeout(() => setShowFailed(true), 400);
      }
      setBusy(true);
      return;
    }

    setBusy(false);
  }

  function handleReplay() {
    setShowComplete(false);
    setShowFailed(false);
    scoreRef.current = 0;
    movesRef.current = levelConfig.moves;
    setScore(0);
    setMovesLeft(levelConfig.moves);
    setEarnedStars(0);
    setCascadeLabel('');
    setSelectedCell(null);
    setHintCell(null);
    const newBoard = initBoard();
    setGrid(newBoard);
    setBusy(false);
  }

  function handleNextLevel() {
    setShowComplete(false);
    onComplete(levelNum);
  }

  return (
    <LinearGradient
      colors={[THEME.bg2, THEME.bg1, THEME.bg3]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {/* HUD */}
      <View style={styles.hud}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.levelLabel}>Level {levelNum}</Text>

        <View style={styles.hudStat}>
          <Text style={styles.hudStatLabel}>SCORE</Text>
          <Text style={styles.hudStatValue}>{score.toLocaleString()}</Text>
        </View>

        <View style={styles.hudStat}>
          <Text style={styles.hudStatLabel}>MOVES</Text>
          <Text style={[styles.hudStatValue, styles.movesValue, movesLeft <= 5 && styles.movesLow]}>
            {movesLeft}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <ProgressBar
        score={score}
        target1={levelConfig.target1}
        target2={levelConfig.target2}
        target3={levelConfig.target3}
      />

      {/* Cascade label */}
      {cascadeLabel !== '' && (
        <View style={styles.cascadeContainer}>
          <Text style={[styles.cascadeText, {
            color: CASCADE_COLORS[Math.min(
              CASCADE_LABELS.indexOf(cascadeLabel),
              CASCADE_COLORS.length - 1
            )] || '#ffd700'
          }]}>
            {cascadeLabel}
          </Text>
        </View>
      )}

      {/* Game Board */}
      <View style={styles.boardContainer}>
        <GameBoard
          grid={grid}
          selectedCell={selectedCell}
          hintCell={hintCell}
          onCellTap={handleCellTap}
          onSwipe={handleSwipe}
          disabled={busy}
        />
      </View>

      {/* Level Complete Modal */}
      <Modal visible={showComplete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#3d1f8a', '#2d1260']}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Level Complete!</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3].map(s => (
                <Text
                  key={s}
                  style={[
                    styles.modalStar,
                    s <= earnedStars && styles.modalStarEarned,
                  ]}
                >
                  ★
                </Text>
              ))}
            </View>
            <Text style={styles.modalScore}>Score: {score.toLocaleString()}</Text>

            <TouchableOpacity onPress={handleNextLevel}>
              <LinearGradient colors={['#4cff50', '#00c853']} style={styles.modalBtn}>
                <Text style={styles.modalBtnTextGreen}>Next Level</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleReplay}>
              <LinearGradient colors={['#7c4dff', '#6200ea']} style={styles.modalBtnSecondary}>
                <Text style={styles.modalBtnText}>Replay</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Level Failed Modal */}
      <Modal visible={showFailed} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#3d1f8a', '#2d1260']}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Out of Moves!</Text>
            <Text style={styles.modalScore}>Score: {score.toLocaleString()}</Text>

            <TouchableOpacity onPress={handleReplay}>
              <LinearGradient colors={['#4cff50', '#00c853']} style={styles.modalBtn}>
                <Text style={styles.modalBtnTextGreen}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onBack}>
              <LinearGradient colors={['#7c4dff', '#6200ea']} style={styles.modalBtnSecondary}>
                <Text style={styles.modalBtnText}>Quit</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 20,
    color: '#fff',
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.accent,
  },
  hudStat: {
    alignItems: 'center',
  },
  hudStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 1,
  },
  hudStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  movesValue: {
    color: '#ffd700',
  },
  movesLow: {
    color: '#ff4757',
  },
  cascadeContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cascadeText: {
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '82%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffd700',
    marginBottom: 16,
    textShadowColor: 'rgba(255,215,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  modalStar: {
    fontSize: 48,
    color: 'rgba(255,255,255,0.2)',
    marginHorizontal: 6,
  },
  modalStarEarned: {
    color: '#ffd700',
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  modalScore: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 28,
  },
  modalBtn: {
    paddingHorizontal: 50,
    paddingVertical: 16,
    borderRadius: 28,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  modalBtnTextGreen: {
    fontSize: 18,
    fontWeight: '900',
    color: '#004d00',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
