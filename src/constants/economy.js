// Faz 1 retention systems: coin/life economy, boosters, daily login, quests, achievements.

export const LIVES_MAX = 5;
export const LIFE_REGEN_MS = 20 * 60 * 1000; // 20 min per life
export const STARTER_COINS = 50;

// Stimulant mechanics — keep the board feeling alive between user moves.
//
// ⚠️ ESKI (KIRIK) MEKANIK — sabit silinmedi, artik TETIKLEYICI DEGIL.
// FRENZY_THRESHOLD tahtadaki en kalabalik rengin hucre sayisina bakiyordu.
// 9x9 = 81 hucre / 6 renk -> guvercin yuvasi geregi en kalabalik renk HER ZAMAN
// >= ceil(81/6) = 14. Olculdu: 2000 tahtanin 2000'inde (%100) esik asiliyordu,
// ortalama en kalabalik renk 17.8. Yani frenzy her hamlede tetikleniyordu ve
// 300 otomatik oyunun 300'u 3 YILDIZ bitiyordu. Esigi buyutmek tek basina
// cozum degildi: DOLU bir tahtanin renk sayimi oyuncunun becerisini olcmez.
export const FRENZY_THRESHOLD = 14;

// YENI MEKANIK — frenzy oyuncunun BIRIKTIRDIGI seyi odullendirir.
// Her renk icin bir "sarj" sayaci tutulur: o renkten temizlenen HER seker
// sayaci 1 artirir. Bir renk FRENZY_CHARGE_TARGET'a ulasinca frenzy patlar ve
// TUM sayaclar SIFIRLANIR. Boylece:
//   - taze tahtada asla tetiklenemez (sayaclar 0'dan baslar),
//   - tetikleyen sey zar degil oyuncunun ust uste o rengi temizlemesidir,
//   - tetiklendikten sonra yeniden birikmesi gerekir (tekrar-tekrar patlamaz).
// OLCULEREK secildi (qa/qa_frenzy_kalibre.mjs, 40 oyun x 30 hamle):
// bir rengin sarji hamle basina ~1.5 birikiyor; 30 hamlede en yuksek sarj
// medyan 43, min 29. Hedef=30 -> ilk frenzy ortalama 19.5. hamlede, 40 oyunun
// 39'unda ulasilabiliyor. Yani UZUN seviyede ~1 kez patlar, KISA seviyede
// (10-12 hamle) genelde hic patlamaz: kazanilan bir odul, garanti degil.
// Karsilastirma: eski esik 2000/2000 tahtada, HER hamlede tetikliyordu.
export const FRENZY_CHARGE_TARGET = 30;
export const FRENZY_COIN_BONUS = 80;

/**
 * Sarj dolmus rengi doner, hicbiri dolmamissa -1.
 * Esitlikte EN COK birikmis renk kazanir (deterministik: ilk en buyuk).
 */
export function frenzyReadyColor(charge) {
  if (!charge) return -1;
  let best = -1;
  let bestVal = FRENZY_CHARGE_TARGET;
  for (let t = 0; t < charge.length; t++) {
    if (charge[t] >= bestVal) {
      bestVal = charge[t] + 1;   // strictly greater kazanir -> ilk en buyuk sabit
      best = t;
    }
  }
  return best;
}
// Lucky drop chances per newly spawned candy — kept low so they read as gifts.
export const LUCKY_STRIPED_CHANCE = 0.04;
export const LUCKY_WRAPPED_CHANCE = 0.015;
export const CHAIN_BONUS_THRESHOLD = 5; // consecutive valid swaps to spawn a free striped
export const CRESCENDO_CASCADE_LEVEL = 4;

// Coin payout per level-end star count (index = stars 0..3).
export const COIN_PER_STAR = [0, 10, 25, 50];
// Per cascade level above the first.
export const CASCADE_COIN_BONUS = 5;

// Win streak coin multiplier.
export const STREAK_MILESTONES = [
  { threshold: 3, mult: 1.5 },
  { threshold: 5, mult: 2.0 },
  { threshold: 10, mult: 3.0 },
];

export function streakMultiplier(streak) {
  let mult = 1;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m.threshold) mult = m.mult;
  }
  return mult;
}

export const BOOSTER_DEFS = {
  plus5:        { id: 'plus5',        name: '+5 Moves',     cost: 50,  type: 'pregame', icon: '⏱',  color: '#4cff50' },
  startBomb:    { id: 'startBomb',    name: 'Color Bomb',   cost: 75,  type: 'pregame', icon: '💣', color: '#a855f7' },
  startStriped: { id: 'startStriped', name: 'Striped Row',  cost: 75,  type: 'pregame', icon: '⚡', color: '#1e90ff' },
  hammer:       { id: 'hammer',       name: 'Hammer',       cost: 100, type: 'ingame',  icon: '🔨', color: '#ffa502' },
  shuffle:      { id: 'shuffle',      name: 'Shuffle',      cost: 50,  type: 'ingame',  icon: '🔀', color: '#ff6bcb' },
};

export const BOOSTER_LIST = Object.values(BOOSTER_DEFS);

// 7-day login cycle. Day index = 1..7.
export const DAILY_LOGIN_REWARDS = [
  { day: 1, coins: 25 },
  { day: 2, coins: 50 },
  { day: 3, coins: 75,  booster: { id: 'plus5', count: 1 } },
  { day: 4, coins: 100 },
  { day: 5, coins: 125, booster: { id: 'hammer', count: 1 } },
  { day: 6, coins: 150 },
  { day: 7, coins: 250, booster: { id: 'startBomb', count: 1 } },
];

// Quest definitions. `desc` uses {N} placeholder for target.
export const QUEST_POOL = [
  { id: 'win_levels',    desc: 'Win {N} levels',                 target: 3,     reward: 50,  event: 'win' },
  { id: 'score_total',   desc: 'Score {N} total this session',   target: 30000, reward: 75,  event: 'score' },
  { id: 'make_striped',  desc: 'Create {N} striped candies',     target: 5,     reward: 60,  event: 'striped' },
  { id: 'make_wrapped',  desc: 'Create {N} wrapped candies',     target: 3,     reward: 75,  event: 'wrapped' },
  { id: 'big_cascade',   desc: 'Trigger {N} 4x+ cascades',       target: 3,     reward: 80,  event: 'bigCascade' },
  { id: 'three_star',    desc: 'Get 3 stars on a level',         target: 1,     reward: 100, event: 'threeStar' },
  { id: 'clear_red',     desc: 'Clear {N} red candies',          target: 80,    reward: 55,  event: 'clearRed' },
  { id: 'clear_blue',    desc: 'Clear {N} blue candies',         target: 80,    reward: 55,  event: 'clearBlue' },
  { id: 'clear_green',   desc: 'Clear {N} green candies',        target: 80,    reward: 55,  event: 'clearGreen' },
];

export const ACHIEVEMENT_DEFS = [
  { id: 'first_match',    name: 'Sweet Start',     desc: 'Make your first match',           reward: 10,
    check: (s) => s.lifetimeMatches >= 1 },
  { id: 'cascade_master', name: 'Cascade Master',  desc: 'Trigger 10 big cascades (4x+)',  reward: 50,
    check: (s) => s.lifetimeCascadesBig >= 10 },
  { id: 'bomb_maker',     name: 'Bomb Maker',      desc: 'Create 10 color bombs',          reward: 75,
    check: (s) => s.lifetimeColorBombs >= 10 },
  { id: 'level_10',       name: 'Getting Sweet',   desc: 'Beat level 10',                  reward: 100,
    check: (s, p) => (p?.maxLevel || 1) > 10 },
  { id: 'level_20',       name: 'Halfway Hero',    desc: 'Beat level 20',                  reward: 200,
    check: (s, p) => (p?.maxLevel || 1) > 20 },
  { id: 'three_star_10',  name: 'Star Collector',  desc: '3-star 10 different levels',    reward: 150,
    check: (s, p) => Object.values(p?.stars || {}).filter((v) => v === 3).length >= 10 },
  { id: 'coin_hoarder',   name: 'Coin Hoarder',    desc: 'Earn 1000 coins lifetime',       reward: 100,
    check: (s) => s.lifetimeCoinsEarned >= 1000 },
  { id: 'streak_5',       name: 'On a Roll',       desc: 'Win 5 levels in a row',          reward: 75,
    check: (s) => s.bestWinStreak >= 5 },
];
