import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIVES_MAX, STARTER_COINS } from '../constants/economy';

const STORAGE_KEY = 'sugarblast_progress';

const DEFAULT_SAVE = {
  // Progression
  maxLevel: 1,
  stars: {},
  highScores: {},

  // Wallet
  coins: STARTER_COINS,
  lives: LIVES_MAX,
  lastLifeRegenMs: 0, // filled in on first load

  // Booster inventory: { [boosterId]: count }
  inventory: {},

  // Daily login
  loginDay: 0,             // 0..7; reset to 0 if streak breaks
  lastLoginDateStr: '',

  // Daily quests
  dailyQuests: [],         // [{ id, target, progress, reward, claimed }]
  lastQuestRefreshDateStr: '',

  // Streaks + lifetime stats
  winStreak: 0,
  stats: {
    lifetimeMatches: 0,
    lifetimeCascadesBig: 0,
    lifetimeSpecialsMade: 0,
    lifetimeColorBombs: 0,
    lifetimeCoinsEarned: 0,
    lifetimeWins: 0,
    bestCascadeLevel: 0,
    bestWinStreak: 0,
  },

  // Achievements: { [id]: true }
  achievements: {},
};

function mergeDefaults(saved) {
  const out = { ...DEFAULT_SAVE, ...saved };
  out.stats = { ...DEFAULT_SAVE.stats, ...(saved.stats || {}) };
  out.inventory = { ...DEFAULT_SAVE.inventory, ...(saved.inventory || {}) };
  out.achievements = { ...DEFAULT_SAVE.achievements, ...(saved.achievements || {}) };
  out.stars = { ...DEFAULT_SAVE.stars, ...(saved.stars || {}) };
  out.highScores = { ...DEFAULT_SAVE.highScores, ...(saved.highScores || {}) };
  out.dailyQuests = saved.dailyQuests || [];
  if (!out.lastLifeRegenMs) out.lastLifeRegenMs = Date.now();
  return out;
}

export async function loadProgress() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return { ...DEFAULT_SAVE, lastLifeRegenMs: Date.now() };
    return mergeDefaults(JSON.parse(data));
  } catch {
    return { ...DEFAULT_SAVE, lastLifeRegenMs: Date.now() };
  }
}

export async function saveProgress(progress) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable
  }
}

export function computeStars(score, level) {
  if (score >= level.target3) return 3;
  if (score >= level.target2) return 2;
  if (score >= level.target1) return 1;
  return 0;
}

// Local YYYY-MM-DD date string for daily resets.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Difference in calendar days between two YYYY-MM-DD strings (a - b).
export function daysBetween(aStr, bStr) {
  if (!aStr || !bStr) return Infinity;
  const a = new Date(aStr + 'T00:00:00');
  const b = new Date(bStr + 'T00:00:00');
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}
