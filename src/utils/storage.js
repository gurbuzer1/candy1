import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sugarblast_progress';

const defaultProgress = {
  maxLevel: 1,
  stars: {},
  highScores: {},
};

export async function loadProgress() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { ...defaultProgress };
  } catch {
    return { ...defaultProgress };
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
