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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import {
  COLS, ROWS, CELL_SIZE, CANDY_SIZE, THEME, SPECIAL, CANDY_COLORS,
} from '../constants/game';
import { LEVELS } from '../constants/levels';
import {
  COIN_PER_STAR, CASCADE_COIN_BONUS, streakMultiplier,
} from '../constants/economy';
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  calculateScore, hasValidMoves, findHint, shuffleBoard,
} from '../engine/BoardEngine';
import { computeStars } from '../utils/storage';
import { tapHaptic, matchHaptic, specialHaptic, errorHaptic } from '../utils/haptics';
import GameBoard from '../components/GameBoard';
import ProgressBar from '../components/ProgressBar';

const CASCADE_LABELS = ['', 'Sweet!', 'Tasty!', 'Delicious!', 'Sugar Rush!', 'INCREDIBLE!'];
const CASCADE_COLORS = ['', '#ffd700', '#ff6bcb', '#ff4757', '#a855f7', '#00ff88'];
const EMPTY_SET = new Set();

const SWAP_SETTLE_MS = 240;
const REVERT_SETTLE_MS = 260;
const MATCH_SHRINK_MS = 300;
const CASCADE_FALL_MS = 420;

const COLOR_NAMES = ['clearRed', 'clearOrange', 'clearYellow', 'clearGreen', 'clearBlue', 'clearPurple'];

function applyPreGameBoosters(board, boosters) {
  const out = board.map((col) => col.slice());
  const used = new Set();
  function pickCell() {
    for (let attempts = 0; attempts < 50; attempts++) {
      const c = Math.floor(Math.random() * COLS);
      const r = Math.floor(Math.random() * ROWS);
      const key = `${c},${r}`;
      if (!used.has(key) && out[c][r]) {
        used.add(key);
        return { c, r };
      }
    }
    return null;
  }
  if (boosters?.startBomb) {
    const p = pickCell();
    if (p) {
      out[p.c][p.r] = { ...out[p.c][p.r], special: SPECIAL.COLOR_BOMB, id: `bst_bomb_${Date.now()}_${p.c}_${p.r}` };
    }
  }
  if (boosters?.startStriped) {
    const p = pickCell();
    if (p) {
      const dir = Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V;
      out[p.c][p.r] = { ...out[p.c][p.r], special: dir, id: `bst_str_${Date.now()}_${p.c}_${p.r}` };
    }
  }
  return out;
}

export default function GameScreen({
  levelNum,
  save,
  boosters = {},
  onLevelEnd,
  onNextLevel,
  onReplay,
  onBack,
  onUseBooster,
}) {
  const levelConfig = LEVELS[levelNum - 1];
  const startMoves = levelConfig.moves + (boosters.plus5 ? 5 : 0);

  const [grid, setGrid] = useState(() => initBoard());
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(startMoves);
  const [selectedCell, setSelectedCell] = useState(null);
  const [hintCell, setHintCell] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cascadeLabel, setCascadeLabel] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [earnedStars, setEarnedStars] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [coinBreakdown, setCoinBreakdown] = useState(null);
  const [removingIds, setRemovingIds] = useState(EMPTY_SET);
  const [hammerActive, setHammerActive] = useState(false);
  const [activations, setActivations] = useState([]);
  const [scorePopups, setScorePopups] = useState([]);

  const scoreRef = useRef(0);
  const movesRef = useRef(startMoves);
  const hintTimerRef = useRef(null);
  const endedRef = useRef(false);

  // Session counters for quests + achievements
  const sessionRef = useRef({
    striped: 0,
    wrapped: 0,
    colorBombs: 0,
    bigCascades: 0,        // 4x+ cascade levels
    maxCascadeLevel: 0,
    matches: 0,
    candiesByColor: [0, 0, 0, 0, 0, 0],
    shuffleUsed: 0,
    hammerUsed: 0,
  });

  function initBoard() {
    let board = createBoard();
    let safety = 0;
    while (findMatches(board).matched.size > 0 && safety < 100) {
      board = createBoard();
      safety++;
    }
    return applyPreGameBoosters(board, boosters);
  }

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

    // Hammer mode: next tap removes that one candy
    if (hammerActive) {
      const target = grid[col]?.[row];
      if (!target) return;
      setHammerActive(false);
      sessionRef.current.hammerUsed += 1;
      if (onUseBooster) onUseBooster('hammer');
      const matchedSet = new Set([`${col},${row}`]);
      const removingSet = new Set([target.id]);
      setRemovingIds(removingSet);
      tapHaptic();
      (async () => {
        setBusy(true);
        await delay(MATCH_SHRINK_MS);
        const { grid: collapsed } = removeAndCollapse(grid, matchedSet);
        setRemovingIds(EMPTY_SET);
        setGrid(collapsed);
        await delay(CASCADE_FALL_MS);
        await processCascade(collapsed, 0);
      })();
      return;
    }

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
  }, [selectedCell, busy, grid, hammerActive]);

  const removeActivation = useCallback((id) => {
    setActivations((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const removePopup = useCallback((id) => {
    setScorePopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

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
    const { matched } = findMatches(swapped);

    if (matched.size > 0) {
      tapHaptic();
      setGrid(swapped);

      const newMoves = movesRef.current - 1;
      movesRef.current = newMoves;
      setMovesLeft(newMoves);

      await delay(SWAP_SETTLE_MS);
      await processCascade(swapped, 0);
    } else {
      errorHaptic();
      setGrid(swapped);
      await delay(SWAP_SETTLE_MS);
      setGrid(grid);
      await delay(REVERT_SETTLE_MS);
      setBusy(false);
    }
  }

  async function processCascade(currentGrid, cascadeLevel) {
    const { matched, matchGroups } = findMatches(currentGrid);

    if (matched.size === 0) {
      setCascadeLabel('');
      if (!hasValidMoves(currentGrid)) {
        const shuffled = shuffleBoard(currentGrid);
        setGrid(shuffled);
        await delay(500);
        setBusy(false);
        return;
      }
      checkEndConditions(currentGrid);
      return;
    }

    if (cascadeLevel > 0) {
      const labelIdx = Math.min(cascadeLevel, CASCADE_LABELS.length - 1);
      setCascadeLabel(CASCADE_LABELS[labelIdx]);
    }

    const specials = determineSpecials(matchGroups);

    // Detect already-existing specials in the matched set — these activate
    // (beam / shock ring / flash) before the candies actually shrink.
    const newActivations = [];
    matched.forEach((key) => {
      const [c, r] = key.split(',').map(Number);
      const candy = currentGrid[c]?.[r];
      if (candy && candy.special !== SPECIAL.NONE) {
        newActivations.push({
          id: `act_${Date.now()}_${c}_${r}_${Math.random().toString(36).slice(2, 6)}`,
          col: c,
          row: r,
          special: candy.special,
          type: candy.type,
        });
      }
    });
    if (newActivations.length > 0) {
      setActivations((prev) => [...prev, ...newActivations]);
    }

    const extraRemovals = getSpecialRemovals(currentGrid, matched);
    extraRemovals.forEach((key) => matched.add(key));

    // Session stat updates
    sessionRef.current.matches += matchGroups.length;
    if (cascadeLevel >= 3) sessionRef.current.bigCascades += 1; // 4x is cascadeLevel 3
    if (cascadeLevel > sessionRef.current.maxCascadeLevel) {
      sessionRef.current.maxCascadeLevel = cascadeLevel;
    }
    specials.forEach((s) => {
      if (s.special === SPECIAL.COLOR_BOMB) sessionRef.current.colorBombs += 1;
      else if (s.special === SPECIAL.WRAPPED) sessionRef.current.wrapped += 1;
      else sessionRef.current.striped += 1;
    });
    matched.forEach((key) => {
      const [c, r] = key.split(',').map(Number);
      const candy = currentGrid[c]?.[r];
      if (candy && candy.type >= 0 && candy.type < 6) {
        sessionRef.current.candiesByColor[candy.type] += 1;
      }
    });

    const points = calculateScore(matchGroups, specials, cascadeLevel);
    const newScore = scoreRef.current + points;
    scoreRef.current = newScore;
    setScore(newScore);

    // Score popups at each match group center
    const cascadeMult = Math.pow(1.5, cascadeLevel);
    const newPopups = matchGroups.map((g, gi) => {
      const center = g.cells[Math.floor(g.cells.length / 2)];
      const base =
        g.cells.length >= 5 ? 200 : g.cells.length === 4 ? 120 : 60;
      return {
        id: `pop_${Date.now()}_${gi}_${center.col}_${center.row}`,
        x: center.col * CELL_SIZE + (CELL_SIZE - 40) / 2,
        y: center.row * CELL_SIZE + CELL_SIZE / 2 - 10,
        score: Math.floor(base * cascadeMult),
        color: CANDY_COLORS[g.type]?.bg || '#fff',
      };
    });
    if (newPopups.length > 0) {
      setScorePopups((prev) => [...prev, ...newPopups]);
    }

    matchHaptic();
    if (specials.length > 0) specialHaptic();

    const idsToRemove = new Set();
    matched.forEach((key) => {
      const [c, r] = key.split(',').map(Number);
      const candy = currentGrid[c]?.[r];
      if (candy) idsToRemove.add(candy.id);
    });
    setRemovingIds(idsToRemove);

    await delay(MATCH_SHRINK_MS);

    let { grid: collapsed } = removeAndCollapse(currentGrid, matched);
    if (specials.length > 0) {
      collapsed = placeSpecials(collapsed, specials);
    }

    setRemovingIds(EMPTY_SET);
    setGrid(collapsed);

    await delay(CASCADE_FALL_MS);
    await processCascade(collapsed, cascadeLevel + 1);
  }

  function checkEndConditions(currentGrid) {
    if (endedRef.current) return;
    const currentScore = scoreRef.current;
    const currentMoves = movesRef.current;

    if (currentMoves <= 0) {
      endedRef.current = true;
      const won = currentScore >= levelConfig.target1;
      const stars = won ? computeStars(currentScore, levelConfig) : 0;
      setEarnedStars(stars);
      const breakdown = computeCoinPayout(stars, won);
      setCoinBreakdown(breakdown);
      setCoinsEarned(breakdown.total);
      emitResult(won, stars, breakdown);
      setTimeout(() => won ? setShowComplete(true) : setShowFailed(true), 400);
      setBusy(true);
      return;
    }
    setBusy(false);
  }

  function computeCoinPayout(stars, won) {
    if (!won) {
      return { base: 0, cascade: 0, mult: 1, total: 0 };
    }
    const base = COIN_PER_STAR[stars] || 0;
    const cascade = sessionRef.current.maxCascadeLevel * CASCADE_COIN_BONUS;
    const newStreak = (save?.winStreak || 0) + 1;
    const mult = streakMultiplier(newStreak);
    const total = Math.round((base + cascade) * mult);
    return { base, cascade, mult, total, newStreak };
  }

  function emitResult(won, stars, breakdown) {
    const s = sessionRef.current;
    const questEvents = [
      ...(won ? [{ type: 'win', value: 1 }] : []),
      { type: 'score', value: scoreRef.current },
      ...(s.striped > 0 ? [{ type: 'striped', value: s.striped }] : []),
      ...(s.wrapped > 0 ? [{ type: 'wrapped', value: s.wrapped }] : []),
      ...(s.bigCascades > 0 ? [{ type: 'bigCascade', value: s.bigCascades }] : []),
      ...(stars === 3 ? [{ type: 'threeStar', value: 1 }] : []),
      ...COLOR_NAMES.map((name, i) => ({ type: name, value: s.candiesByColor[i] })),
    ];

    onLevelEnd?.({
      levelNum,
      won,
      score: scoreRef.current,
      stars,
      coinsEarned: breakdown.total,
      coinBreakdown: breakdown,
      newStreak: breakdown.newStreak ?? 0,
      statsDelta: {
        lifetimeMatches: s.matches,
        lifetimeCascadesBig: s.bigCascades,
        lifetimeSpecialsMade: s.striped + s.wrapped + s.colorBombs,
        lifetimeColorBombs: s.colorBombs,
        lifetimeWins: won ? 1 : 0,
        bestCascadeLevel: s.maxCascadeLevel,
      },
      questEvents,
      inventoryUsed: {
        shuffle: s.shuffleUsed,
        hammer: s.hammerUsed,
      },
    });
  }

  function handleShuffle() {
    if (busy) return;
    if ((save?.inventory?.shuffle || 0) <= 0) return;
    sessionRef.current.shuffleUsed += 1;
    if (onUseBooster) onUseBooster('shuffle');
    setGrid(shuffleBoard(grid));
    tapHaptic();
  }

  function handleHammer() {
    if (busy) return;
    if ((save?.inventory?.hammer || 0) <= 0) return;
    setHammerActive((v) => !v);
  }

  const shuffleCount = save?.inventory?.shuffle || 0;
  const hammerCount = save?.inventory?.hammer || 0;

  return (
    <LinearGradient
      colors={[THEME.bg2, THEME.bg1, THEME.bg3]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

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

      <ProgressBar
        score={score}
        target1={levelConfig.target1}
        target2={levelConfig.target2}
        target3={levelConfig.target3}
      />

      <View style={styles.boosterRow}>
        <TouchableOpacity
          activeOpacity={shuffleCount > 0 ? 0.7 : 1}
          onPress={handleShuffle}
          style={[styles.boosterBtn, shuffleCount <= 0 && styles.boosterDisabled]}
        >
          <Text style={styles.boosterIcon}>🔀</Text>
          <Text style={styles.boosterCount}>×{shuffleCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={hammerCount > 0 ? 0.7 : 1}
          onPress={handleHammer}
          style={[
            styles.boosterBtn,
            hammerCount <= 0 && styles.boosterDisabled,
            hammerActive && styles.boosterActive,
          ]}
        >
          <Text style={styles.boosterIcon}>🔨</Text>
          <Text style={styles.boosterCount}>×{hammerCount}</Text>
        </TouchableOpacity>
        {hammerActive && (
          <Text style={styles.hammerHint}>Tap a candy to destroy it</Text>
        )}
      </View>

      {cascadeLabel !== '' && (
        <CascadeLabel
          key={cascadeLabel}
          text={cascadeLabel}
          color={
            CASCADE_COLORS[Math.min(
              CASCADE_LABELS.indexOf(cascadeLabel),
              CASCADE_COLORS.length - 1,
            )] || '#ffd700'
          }
        />
      )}

      <View style={styles.boardContainer}>
        <GameBoard
          grid={grid}
          selectedCell={selectedCell}
          hintCell={hintCell}
          removingIds={removingIds}
          activations={activations}
          scorePopups={scorePopups}
          onActivationDone={removeActivation}
          onPopupDone={removePopup}
          onCellTap={handleCellTap}
          onSwipe={handleSwipe}
          disabled={busy}
        />
      </View>

      {/* Level Complete Modal */}
      <Modal visible={showComplete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Level Complete!</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3].map((s) => (
                <AnimatedStar key={s} index={s} earned={s <= earnedStars} />
              ))}
            </View>
            <Text style={styles.modalScore}>Score: {score.toLocaleString()}</Text>
            {coinBreakdown && <CoinBreakdownView b={coinBreakdown} />}

            <TouchableOpacity onPress={() => { setShowComplete(false); onNextLevel?.(); }}>
              <LinearGradient colors={['#4cff50', '#00c853']} style={styles.modalBtn}>
                <Text style={styles.modalBtnTextGreen}>Next Level</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setShowComplete(false); onBack?.(); }}>
              <LinearGradient colors={['#7c4dff', '#6200ea']} style={styles.modalBtnSecondary}>
                <Text style={styles.modalBtnText}>Back to Levels</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Level Failed Modal */}
      <Modal visible={showFailed} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#3d1f8a', '#2d1260']} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Out of Moves!</Text>
            <Text style={styles.modalScore}>Score: {score.toLocaleString()}</Text>
            <Text style={styles.streakBroken}>Streak reset to 0</Text>

            <TouchableOpacity onPress={() => { setShowFailed(false); onReplay?.(); }}>
              <LinearGradient colors={['#4cff50', '#00c853']} style={styles.modalBtn}>
                <Text style={styles.modalBtnTextGreen}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setShowFailed(false); onBack?.(); }}>
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

function CascadeLabel({ text, color }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(-14);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.3, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 110 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 160 }),
      withTiming(1, { duration: 350 }),
      withTiming(0, { duration: 220 }),
    );
    rotate.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.back(1.8)) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.cascadeContainer, animStyle]} pointerEvents="none">
      <Text style={[styles.cascadeText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

function CoinBreakdownView({ b }) {
  return (
    <View style={styles.breakdown}>
      <BreakdownRow label="Star reward" value={b.base} />
      {b.cascade > 0 && <BreakdownRow label="Cascade bonus" value={b.cascade} />}
      {b.mult !== 1 && (
        <BreakdownRow label={`Streak ×${b.mult}`} value={Math.round((b.base + b.cascade) * b.mult) - (b.base + b.cascade)} />
      )}
      <View style={styles.breakdownTotal}>
        <Text style={styles.breakdownTotalLabel}>Total</Text>
        <Text style={styles.breakdownTotalValue}>🪙 <AnimatedCounter target={b.total} /></Text>
      </View>
    </View>
  );
}

function BreakdownRow({ label, value }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>+🪙 {value}</Text>
    </View>
  );
}

function AnimatedCounter({ target, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setDisplay(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.floor(target * eased));
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [target, duration]);
  return <>{display}</>;
}

function AnimatedStar({ index, earned }) {
  const scale = useSharedValue(earned ? 0 : 1);
  const opacity = useSharedValue(earned ? 0 : 0.25);

  useEffect(() => {
    if (!earned) return;
    const delay = (index - 1) * 220;
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.55, { duration: 240, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
      ),
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }));
  }, [earned, index]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.modalStar, earned && styles.modalStarEarned, style]}>
      ★
    </Animated.Text>
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  boosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 10,
  },
  boosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  boosterDisabled: {
    opacity: 0.35,
  },
  boosterActive: {
    borderColor: '#ffd700',
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
  },
  boosterIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  boosterCount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },
  hammerHint: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '84%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffd700',
    marginBottom: 12,
    textShadowColor: 'rgba(255,215,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  modalStar: {
    fontSize: 44,
    color: 'rgba(255,255,255,0.2)',
    marginHorizontal: 5,
  },
  modalStarEarned: {
    color: '#ffd700',
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  modalScore: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 14,
  },
  streakBroken: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4757',
    marginBottom: 18,
  },
  breakdown: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#b388ff',
    fontWeight: '700',
  },
  breakdownValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 6,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    color: '#ffd700',
    fontWeight: '900',
  },
  breakdownTotalValue: {
    fontSize: 16,
    color: '#ffd700',
    fontWeight: '900',
  },
  modalBtn: {
    paddingHorizontal: 50,
    paddingVertical: 14,
    borderRadius: 26,
    marginBottom: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    paddingHorizontal: 40,
    paddingVertical: 11,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  modalBtnTextGreen: {
    fontSize: 17,
    fontWeight: '900',
    color: '#004d00',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
