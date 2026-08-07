import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIVES_MAX, STARTER_COINS } from '../constants/economy';
import { LEVELS } from '../constants/levels';

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

// ---------------------------------------------------------------------------
// KAYITLI DURUM = GUVENILMEZ GIRDI
//
// Eski `mergeDefaults` bir SEKIL BIRLESTIRICISIYDI, DOGRULAYICI degildi:
// `{ ...DEFAULT_SAVE, ...saved }` kaydi oldugu gibi iceri aliyordu. Olculen
// sonuclar (qa/BULGULAR.md, lens: durum):
//   - {"maxLevel":999}   -> 30/30 seviye acik, kazanilmis yildiz 0
//   - {"maxLevel":1e400} -> JSON.parse Infinity uretiyor, ayni sonuc
//   - {"maxLevel":-5}    -> 0 seviye acik, oyun oynanamaz
//   - {"coins":"50"}     -> "50" + 25 = "5025" (metin BIRLESTIRME)
//   - {"coins":1e400}    -> HUD "Infinity"
//   - {"coins":-999}     -> dukkan kilitli, kayit kendini onaramiyor
//   - {"dailyQuests":[1,2,3]} + bugunun tarihi -> quests.js'in `length===3`
//     kapisini geciyor -> DailyQuestsModal TypeError ile COKUYOR
//
// Asagidaki dogrulayicilar SEKLI degil KURALI de sinar. Ozellikle `maxLevel`
// artik kayittan OKUNMUYOR, kazanilmis yildiz/skorlardan TURETILIYOR.
// ---------------------------------------------------------------------------

const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sonlu bir tam sayiya zorlar ve [min,max] araligina kirpar. */
export function safeInt(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && value.trim() !== '') n = Number(value);
  else n = NaN;
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, fallback));
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** YYYY-MM-DD sekline uymayan her seyi '' yapar. */
export function safeDateStr(value) {
  return typeof value === 'string' && DATE_STR_RE.test(value) ? value : '';
}

/** { "3": 2 } bicimli haritalari sayisal anahtar + kirpilmis sayiya zorlar. */
function safeNumberMap(raw, min, max, maxKey = Number.MAX_SAFE_INTEGER) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of Object.keys(raw)) {
    const k = Number(key);
    if (!Number.isInteger(k) || k < 1 || k > maxKey) continue;
    const v = safeInt(raw[key], 0, min, max);
    if (v > 0) out[String(k)] = v;
  }
  return out;
}

/**
 * Gorev nesnesinin SEKLI VE KURALI. `progress`in `target`i asmamasi ve
 * `target`in 0'dan buyuk olmasi da kuraldir; sadece alan varligi yetmez.
 */
export function isValidQuest(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
  if (typeof q.id !== 'string' || q.id === '') return false;
  if (typeof q.desc !== 'string' || q.desc === '') return false;
  if (!Number.isFinite(q.target) || q.target <= 0) return false;
  if (!Number.isFinite(q.progress) || q.progress < 0) return false;
  if (q.progress > q.target) return false;
  if (!Number.isFinite(q.reward) || q.reward < 0) return false;
  if (typeof q.claimed !== 'boolean') return false;
  return true;
}

/** Tek bir bozuk gorev bile listeyi gecersiz kilar -> [] dondurulur ki
 *  quests.js `length===3` kapisinda takilip GUNU YENIDEN URETSIN. */
export function sanitizeQuests(raw) {
  if (!Array.isArray(raw)) return [];
  if (!raw.every(isValidQuest)) return [];
  return raw.map((q) => ({ ...q }));
}

/**
 * maxLevel'i KAZANILMIS ilerlemeden TURETIR.
 * Kural: GameScreen.js:664 `won = currentScore >= levelConfig.target1`, yani
 * kazanilan her seviye en az 1 yildiz verir ve App.js:171/175 stars+highScores
 * yazar. Dolayisiyla "tamamlanmis seviye" = stars>=1 veya highScore>0.
 * En yuksek tamamlanmis seviye + 1, [1, LEVELS.length] araligina kirpilir.
 */
export function deriveMaxLevel(stars, highScores) {
  let best = 0;
  for (const key of Object.keys(stars || {})) {
    const n = Number(key);
    if (Number.isInteger(n) && n > best && safeInt(stars[key], 0, 0, 3) >= 1) best = n;
  }
  for (const key of Object.keys(highScores || {})) {
    const n = Number(key);
    if (Number.isInteger(n) && n > best && safeInt(highScores[key], 0, 0) > 0) best = n;
  }
  return Math.min(LEVELS.length, Math.max(1, best + 1));
}

/** Guvenilmez kaydi guvenli bir kayda cevirir. Girdi ne olursa olsun coker
 *  degil, oynanabilir bir kayit doner. */
export function sanitizeSave(saved, now = Date.now()) {
  const raw = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const out = { ...DEFAULT_SAVE };

  // --- Ilerleme (TURETILIR, kayittan okunmaz) ---
  out.stars = safeNumberMap(raw.stars, 0, 3, LEVELS.length);
  out.highScores = safeNumberMap(raw.highScores, 0, Number.MAX_SAFE_INTEGER, LEVELS.length);
  out.maxLevel = deriveMaxLevel(out.stars, out.highScores);

  // --- Cuzdan ---
  out.coins = safeInt(raw.coins, STARTER_COINS, 0, 1e9);
  out.lives = safeInt(raw.lives, LIVES_MAX, 0, LIVES_MAX);
  // Gelecege ayarli anchor rejenerasyonu sonsuza kilitler (bkz. lives.js).
  out.lastLifeRegenMs = safeInt(raw.lastLifeRegenMs, now, 0, now) || now;

  // --- Envanter / basarimlar ---
  out.inventory = {};
  if (raw.inventory && typeof raw.inventory === 'object' && !Array.isArray(raw.inventory)) {
    for (const key of Object.keys(raw.inventory)) {
      out.inventory[key] = safeInt(raw.inventory[key], 0, 0, 9999);
    }
  }
  out.achievements = {};
  if (raw.achievements && typeof raw.achievements === 'object' && !Array.isArray(raw.achievements)) {
    for (const key of Object.keys(raw.achievements)) {
      if (raw.achievements[key] === true) out.achievements[key] = true;
    }
  }

  // --- Gunluk giris ---
  out.loginDay = safeInt(raw.loginDay, 0, 0, 7);
  out.lastLoginDateStr = safeDateStr(raw.lastLoginDateStr);

  // --- Gunluk gorevler ---
  out.dailyQuests = sanitizeQuests(raw.dailyQuests);
  out.lastQuestRefreshDateStr = out.dailyQuests.length === 3
    ? safeDateStr(raw.lastQuestRefreshDateStr)
    : '';

  // --- Seri + istatistikler ---
  out.winStreak = safeInt(raw.winStreak, 0, 0);
  out.stats = { ...DEFAULT_SAVE.stats };
  const rawStats = raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats) ? raw.stats : {};
  for (const key of Object.keys(DEFAULT_SAVE.stats)) {
    out.stats[key] = safeInt(rawStats[key], 0, 0);
  }

  return out;
}

// Eski ad korunuyor (hicbir sey silinmedi): artik dogrulayiciya yonlendiriyor.
function mergeDefaults(saved) {
  return sanitizeSave(saved);
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

/**
 * Gunluk giris karari — TEK KARAR NOKTASI (soguk acilis VE gece yarisi devri).
 *
 * ESKI KURAL (App.js:56) `s.lastLoginDateStr !== today` idi, yani ESITSIZLIK.
 * Cihaz saati GERI alindiginda da saglaniyordu ve `daysSince` negatif oldugu
 * icin dal `nextDay = 1`e dusup odulu YENIDEN veriyordu; olculdu: 2026-08-07
 * <-> 2026-08-06 arasi 5 acilis = 175 coin, dongu sonsuz.
 *
 * YENI KURAL: odul yalnizca tarih ILERI gittiginde verilir (`daysBetween >= 1`).
 * `lastLoginDateStr` boylece "gorulmus en yuksek gun" olarak kalir; saat geri
 * alinip ileri getirilse bile ayni gun ikinci kez odenmez.
 */
export function evaluateDailyLogin(save, today = localDateStr()) {
  const last = safeDateStr(save?.lastLoginDateStr);
  const day = safeInt(save?.loginDay, 0, 0, 7);
  const daysSince = daysBetween(today, last);

  // Ayni gun (0) veya GERI alinmis saat (negatif) -> odul yok.
  if (Number.isFinite(daysSince) && daysSince <= 0) {
    return { showModal: false, nextDay: 0, daysSince };
  }
  const nextDay = daysSince === 1 && day > 0 && day < 7 ? day + 1 : 1;
  return { showModal: true, nextDay, daysSince };
}

/**
 * Gorevler bugune ait ve SAGLAM mi? quests.js'in kendi kapisi yalnizca
 * `length === 3` + tarih soruyor; bu yardimci ayrica her gorevin KURALINI
 * dogrular, boylece bozuk/eski-surum gorev listesi yenilenmeye zorlanir.
 */
export function needsQuestRefresh(save, today = localDateStr()) {
  if (safeDateStr(save?.lastQuestRefreshDateStr) !== today) return true;
  const quests = save?.dailyQuests;
  if (!Array.isArray(quests) || quests.length !== 3) return true;
  return !quests.every(isValidQuest);
}
