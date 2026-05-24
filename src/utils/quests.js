import { QUEST_POOL } from '../constants/economy';
import { localDateStr } from './storage';

// Pick 3 distinct quests for today, seeded by date string so refreshes match.
function pickQuestsForDate(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const pool = [...QUEST_POOL];
  const chosen = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const idx = h % pool.length;
    const q = pool.splice(idx, 1)[0];
    chosen.push({
      id: q.id,
      event: q.event,
      desc: q.desc.replace('{N}', String(q.target)),
      target: q.target,
      progress: 0,
      reward: q.reward,
      claimed: false,
    });
  }
  return chosen;
}

// Ensure save has today's quests (mutates a copy, returns it).
export function ensureDailyQuests(save) {
  const today = localDateStr();
  if (save.lastQuestRefreshDateStr === today && save.dailyQuests?.length === 3) {
    return save;
  }
  return {
    ...save,
    dailyQuests: pickQuestsForDate(today),
    lastQuestRefreshDateStr: today,
  };
}

// Apply a batch of events to quest progress. Each event has { type, value }.
// Returns { quests, claimableCoins } — coins are auto-paid once a quest hits
// its target (so users don't need a manual "claim" button for v1).
export function applyQuestEvents(save, events) {
  if (!save.dailyQuests?.length || !events?.length) {
    return { quests: save.dailyQuests || [], earnedCoins: 0, completedIds: [] };
  }
  const quests = save.dailyQuests.map((q) => ({ ...q }));
  let earnedCoins = 0;
  const completedIds = [];

  for (const ev of events) {
    for (const q of quests) {
      if (q.claimed) continue;
      if (q.event !== ev.type) continue;
      q.progress = Math.min(q.target, q.progress + (ev.value || 1));
      if (q.progress >= q.target && !q.claimed) {
        q.claimed = true;
        earnedCoins += q.reward;
        completedIds.push(q.id);
      }
    }
  }

  return { quests, earnedCoins, completedIds };
}
