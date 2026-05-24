import { ACHIEVEMENT_DEFS } from '../constants/economy';

// Check all achievement conditions. Returns { newlyUnlocked: [defs], rewardCoins }.
// Caller is responsible for marking save.achievements[id] = true.
export function checkUnlocks(save) {
  const newlyUnlocked = [];
  let rewardCoins = 0;
  const stats = save.stats || {};
  for (const def of ACHIEVEMENT_DEFS) {
    if (save.achievements?.[def.id]) continue;
    try {
      if (def.check(stats, save)) {
        newlyUnlocked.push(def);
        rewardCoins += def.reward;
      }
    } catch {
      // Defensive: malformed save shouldn't crash check
    }
  }
  return { newlyUnlocked, rewardCoins };
}
