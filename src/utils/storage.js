import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIVES_MAX, STARTER_COINS, BOOSTER_DEFS, QUEST_POOL } from '../constants/economy';
import { LEVELS } from '../constants/levels';
import { checkUnlocks } from './achievements';

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

/** id -> havuzdaki gorev tanimi (gorevin GERCEKTEN var olup olmadigi sorusu). */
const QUEST_BY_ID = {};
for (const q of QUEST_POOL) QUEST_BY_ID[q.id] = q;

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
  // --- ALANLAR ARASI: gorev QUEST_POOL'da GERCEKTEN var mi? ---
  // Gorevleri uretebilen tek yer quests.js:16-24'tur ve id/event/target/reward
  // dortlusunu havuzdan OLDUGU GIBI kopyalar. Olculdu (qa/dusman_kayit.mjs E):
  //   uydurma id + reward 999999999 -> tek "win" olayinda 2.999.999.997 coin
  //   gercek id + reward 500000     -> 1.500.000 coin (havuz degeri 185)
  //   `event` alani HIC YOK         -> gorevler gun boyu ILERLEMIYOR (olu gun)
  // Yani sekil dogruydu, KURAL yoktu. Havuzla birebir eslesmeyen gorev
  // "mesru oyunla ulasilamaz" durumdur.
  const def = QUEST_BY_ID[q.id];
  if (!def) return false;
  if (q.event !== def.event) return false;
  if (q.target !== def.target) return false;
  if (q.reward !== def.reward) return false;
  return true;
}

/** Tek bir bozuk gorev bile listeyi gecersiz kilar -> [] dondurulur ki
 *  quests.js `length===3` kapisinda takilip GUNU YENIDEN URETSIN.
 *  AYNI gorev iki kez yazilmis olamaz: quests.js havuzdan `splice` ile secer,
 *  yani gunun uc gorevi FARKLI id'lidir (ayni gorevi iki kez odetme yolu). */
export function sanitizeQuests(raw) {
  if (!Array.isArray(raw)) return [];
  if (!raw.every(isValidQuest)) return [];
  const gorulen = new Set();
  for (const q of raw) {
    if (gorulen.has(q.id)) return [];
    gorulen.add(q.id);
  }
  return raw.map((q) => ({ ...q }));
}

/**
 * ESKI TURETME — SILINMEDI, artik KULLANILMIYOR (asagidaki zincir kurali gecti).
 *
 * Bu surum "EN YUKSEK tamamlanmis seviye + 1" diyordu, yani tek bir kayda
 * bakiyordu. Olculdu (qa/dusman_kayit.mjs, C bolumu):
 *   {"stars":{"30":3}}        -> maxLevel 30  (30/30 seviye acildi)
 *   {"highScores":{"29":1}}   -> maxLevel 30  (TEK puan yetti)
 * Yani `maxLevel` alanina inanmayi biraktik ama yerine GUVENILMEZ IKI ALANA
 * inanmaya basladik: istismar kapanmadi, BIR ALAN OTEYE TASINDI.
 * Karsilastirma icin export edilmis halde duruyor (bkz. testler).
 */
export function deriveMaxLevelZincirsiz(stars, highScores) {
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

// ---------------------------------------------------------------------------
// ULASILABILIRLIK KURALI — "sekli dogru mu" DEGIL, "MESRU OYUNLA BU DURUMA
// GELINEBILIR MI".
//
// App.js:357-366 tek yazma noktasidir ve YALNIZCA `result.won` iken yazar:
//     next.stars[n]      = max(eski, kazanilan yildiz)
//     next.highScores[n] = max(eski, o elin skoru)
// Bundan CIKAN kurallar (hepsi koddan turetildi, tahmin degil):
//   K1  bir seviyede KAYIT varsa o seviye KAZANILMISTIR (kaybedince yazilmaz),
//   K2  kayit varsa skor da vardir: ikisi BIRLIKTE yazilir -> yildizi olup
//       skoru olmayan seviye IMKANSIZDIR,
//   K3  ikisi de MAKSIMUM oldugu ve computeStars monoton oldugu icin
//       stars[n] === computeStars(highScores[n]) -> yildiz TURETILEBILIR,
//   K4  seviye n oynanabilmesi icin 1..n-1 KAZANILMIS olmali (LevelSelect
//       `num <= maxLevel` kapisi) -> kayitlar KESINTISIZ BIR ONEK olusturur.
//
// Yani ilerleme artik tek tek anahtarlardan degil, 1'den baslayan KESINTISIZ
// ZINCIRDEN okunur. Zincir kirildigi yerde ilerleme KIRPILIR (kayit silinmez,
// ulasilabilir en yuksek noktaya cekilir).
// ---------------------------------------------------------------------------

/**
 * Seviye n icin "kazanildi" KANITI var mi?
 *
 * Katı olcut skorun target1'i gecmesidir (K1). Ama skor tablosu yeniden
 * kalibre edilebildigi icin (levels.js 2026-08-07'de tamamen degisti) ESKI
 * kayitlarin skoru YENI target1'in altinda kalabilir; bu mesru oyuncuyu
 * cezalandirmasin diye yazili yildiz IKINCI kanit olarak kabul edilir.
 * Ikisinden hicbiri yoksa (ozellikle: skor kaydi HIC yoksa) seviye
 * kazanilmamis sayilir -- `{"stars":{"30":3}}` istismarini kapatan sart budur.
 */
export function levelWon(n, stars, highScores) {
  const lv = LEVELS[n - 1];
  if (!lv) return false;
  const score = safeInt(highScores?.[String(n)], 0, 0);
  if (score <= 0) return false;
  if (score >= lv.target1) return true;
  return safeInt(stars?.[String(n)], 0, 0, 3) >= 1;
}

/**
 * Ham stars/highScores'u ULASILABILIR ilerlemeye kirpar.
 * Doner: { stars, highScores, maxLevel } — hepsi TURETILMIS.
 *   - zincir 1'den baslar, ilk kazanilmamis seviyede durur,
 *   - o noktadan sonraki butun kayitlar dusurulur (oynanmasi imkansizdi),
 *   - yildizlar skordan TURETILIR (K3): yazili yildiza inanilmaz.
 */
export function reachableProgress(rawStars, rawHighScores) {
  const stars = safeNumberMap(rawStars, 0, 3, LEVELS.length);
  const highScores = safeNumberMap(rawHighScores, 0, Number.MAX_SAFE_INTEGER, LEVELS.length);
  const outStars = {};
  const outHigh = {};
  let n = 1;
  while (n <= LEVELS.length && levelWon(n, stars, highScores)) {
    const score = highScores[String(n)];
    outHigh[String(n)] = score;
    const kazanilan = computeStars(score, LEVELS[n - 1]);
    if (kazanilan > 0) outStars[String(n)] = kazanilan;
    n++;
  }
  // n = zincirin KIRILDIGI seviye = oynanabilecek en yuksek seviye.
  return { stars: outStars, highScores: outHigh, maxLevel: Math.min(LEVELS.length, n) };
}

/** maxLevel'i ULASILABILIR zincirden turetir (eski surum: deriveMaxLevelZincirsiz). */
export function deriveMaxLevel(stars, highScores) {
  return reachableProgress(stars, highScores).maxLevel;
}

/**
 * Elde tutulabilecek EN FAZLA para. App.js'te paranin BUTUN girisleri
 * (seviye sonu 339/354, gorev 374/376, basarim 384/385, gunluk giris 256/261)
 * ayni anda `stats.lifetimeCoinsEarned`e de yaziliyor; tek cikis ise harcama
 * (444). Dolayisiyla mesru bir kayitta HER ZAMAN:
 *     coins <= STARTER_COINS + lifetimeCoinsEarned
 * Bu esitsizlik bozuluysa para KAZANILMAMIS, YAZILMISTIR.
 */
export function maxReachableCoins(stats) {
  return STARTER_COINS + safeInt(stats?.lifetimeCoinsEarned, 0, 0);
}

/**
 * Bir booster'dan en fazla kac tane BIRIKTIRILEBILIRDI?
 *   - satin alma: (baslangic + kazanilan) / fiyat
 *   - gunluk giris hediyesi: her hediye en az 75 coin'lik bir gunle birlikte
 *     geldigi icin kazanilan/75 kaba (comert) ust sinir; +1 ilk gun payi.
 * Comert bilerek: amac mesru oyuncuyu kirpmak degil, "9999 cekic" gibi
 * ULASILAMAZ yiginlari elemek.
 */
export function maxReachableBooster(id, lifetimeCoinsEarned) {
  const def = BOOSTER_DEFS[id];
  if (!def) return 0;
  const kazanilan = safeInt(lifetimeCoinsEarned, 0, 0);
  const satinAlinabilir = Math.floor((STARTER_COINS + kazanilan) / def.cost);
  const hediye = Math.floor(kazanilan / 75) + 1;
  return satinAlinabilir + hediye;
}

/**
 * Istatistiklerin ALANLAR ARASI kurali. Hepsi GameScreen.js:786-793'teki tek
 * yazma noktasindan turetildi:
 *   lifetimeSpecialsMade = striped + wrapped + colorBombs  -> colorBombs <= specials
 *   her ozel seker bir eslesmeden dogar                    -> specials   <= matches
 *   4x kademe en az 4 eslesme ister                        -> cascadesBig<= matches
 *   k'lik seri k galibiyet ister                           -> bestStreak <= wins
 * Bu esitsizlikler bozulmussa sayilar OYNANARAK degil ELLE yazilmistir.
 */
export function clampStats(rawStats) {
  const out = { ...DEFAULT_SAVE.stats };
  const raw = rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats) ? rawStats : {};
  for (const key of Object.keys(DEFAULT_SAVE.stats)) {
    out[key] = safeInt(raw[key], 0, 0);
  }
  out.lifetimeSpecialsMade = Math.min(out.lifetimeSpecialsMade, out.lifetimeMatches);
  out.lifetimeColorBombs = Math.min(out.lifetimeColorBombs, out.lifetimeSpecialsMade);
  out.lifetimeCascadesBig = Math.min(out.lifetimeCascadesBig, out.lifetimeMatches);
  out.bestCascadeLevel = Math.min(out.bestCascadeLevel, out.lifetimeMatches);
  out.bestWinStreak = Math.min(out.bestWinStreak, out.lifetimeWins);
  return out;
}

/** Guvenilmez kaydi guvenli bir kayda cevirir. Girdi ne olursa olsun coker
 *  degil, oynanabilir bir kayit doner. */
export function sanitizeSave(saved, now = Date.now()) {
  const raw = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const out = { ...DEFAULT_SAVE };

  // --- Ilerleme (TURETILIR, kayittan okunmaz) ---
  // ESKI HALI (silinmedi, karsilastirma icin): tek tek anahtarlara bakiyordu
  //   out.stars = safeNumberMap(raw.stars, 0, 3, LEVELS.length);
  //   out.highScores = safeNumberMap(raw.highScores, 0, MAX, LEVELS.length);
  //   out.maxLevel = deriveMaxLevelZincirsiz(out.stars, out.highScores);
  // Artik 1'den baslayan KESINTISIZ ZINCIR okunuyor ve zincirin kirildigi
  // yerde ilerleme KIRPILIYOR (bkz. reachableProgress).
  const ilerleme = reachableProgress(raw.stars, raw.highScores);
  out.stars = ilerleme.stars;
  out.highScores = ilerleme.highScores;
  out.maxLevel = ilerleme.maxLevel;

  // --- Seri + istatistikler (cuzdan tavani BUNLARDAN turedigi icin ONCE) ---
  out.stats = clampStats(raw.stats);
  // App.js:351 `bestWinStreak = max(eski, guncel)` -> guncel seri en fazla
  // en iyi seri kadar olabilir.
  out.winStreak = Math.min(safeInt(raw.winStreak, 0, 0), out.stats.bestWinStreak);

  // --- Cuzdan ---
  // ALANLAR ARASI: elde tutulan para KAZANILANDAN fazla olamaz.
  out.coins = Math.min(
    safeInt(raw.coins, STARTER_COINS, 0, 1e9),
    maxReachableCoins(out.stats),
  );
  // Can: alan YOKSA yeni oyuncu (LIVES_MAX), VARSA ve bozuksa 0 -- bozuk kayit
  // odullendirilmez (ayni kural lives.js normalizeLives'ta da var).
  out.lives = raw.lives == null ? LIVES_MAX : safeInt(raw.lives, 0, 0, LIVES_MAX);
  // Gelecege ayarli anchor rejenerasyonu sonsuza kilitler (bkz. lives.js).
  out.lastLifeRegenMs = safeInt(raw.lastLifeRegenMs, now, 0, now) || now;

  // --- Envanter / basarimlar ---
  out.inventory = {};
  if (raw.inventory && typeof raw.inventory === 'object' && !Array.isArray(raw.inventory)) {
    for (const key of Object.keys(raw.inventory)) {
      // BOOSTER_DEFS'te olmayan id UI'da hic gorunmez (sessiz cop) -> alinmaz.
      if (!Object.prototype.hasOwnProperty.call(BOOSTER_DEFS, key)) continue;
      const tavan = maxReachableBooster(key, out.stats.lifetimeCoinsEarned);
      out.inventory[key] = safeInt(raw.inventory[key], 0, 0, tavan);
    }
  }
  out.achievements = {};
  if (raw.achievements && typeof raw.achievements === 'object' && !Array.isArray(raw.achievements)) {
    for (const key of Object.keys(raw.achievements)) {
      if (raw.achievements[key] === true) out.achievements[key] = true;
    }
  }
  // ALANLAR ARASI: kosulu ZATEN saglayan basarim ACILMIS OLMAK ZORUNDADIR.
  // App.js:380-386 basarimi kosul saglandigi anda acar VE oder. Dolayisiyla
  // "istatistik yetiyor ama bayrak false" durumu mesru oyunla ulasilamaz;
  // olculdu (qa/dusman_kayit.mjs D): achievements'i elle `false` yapmak 310
  // coin'i HER YUKLEMEDE yeniden odetiyordu (sonsuz para dongusu).
  // Burada bayrak ACILIR ama ODEME YAPILMAZ: sisirilmis istatistik rozet
  // verebilir, PARA veremez. (Bilinen taviz: odulu gunluk-giris parasiyla tam
  // esikte kazanip seviye bitirmeden uygulamayi kapatan oyuncu o bir kerelik
  // odulu kaybeder -- sonsuz para dongusune tercih edildi.)
  for (const def of checkUnlocks(out).newlyUnlocked) {
    out.achievements[def.id] = true;
  }

  // --- Gunluk giris ---
  out.loginDay = safeInt(raw.loginDay, 0, 0, 7);
  // GELECEK tarih mesru oyunla yazilamaz ve evaluateDailyLogin'i KILITLER
  // (olculdu: '2099-12-31' -> daysSince -26809 -> 2099'a kadar odul YOK).
  // Bugune KIRPILIR: kilit acilir (yarin odul gelir) ama BUGUN icin bedava
  // ikinci odul de dogmaz -- BULGU 5'in "saat geri alinip odul tekrarlanamaz"
  // kurali korunur. (Not: qa/dusman_kayit2.mjs I2 burada bugun odul BEKLIYOR;
  // o beklenti BULGU 5 ile CELISIYOR, bilerek karsilanmadi.)
  const bugunStr = localDateStr(new Date(now));
  const kayitliGun = safeDateStr(raw.lastLoginDateStr);
  out.lastLoginDateStr = kayitliGun && kayitliGun > bugunStr ? bugunStr : kayitliGun;
  // Tarihsiz bir seri olamaz (App.js:265 ikisini birlikte yazar).
  if (out.lastLoginDateStr === '') out.loginDay = 0;

  // --- Gunluk gorevler ---
  out.dailyQuests = sanitizeQuests(raw.dailyQuests);
  out.lastQuestRefreshDateStr = out.dailyQuests.length === 3
    ? safeDateStr(raw.lastQuestRefreshDateStr)
    : '';

  // --- Seri + istatistikler ---
  // BU BLOK YUKARI TASINDI (cuzdan tavani stats'tan turedigi icin ONCE
  // hesaplanmali). Eski hali silinmedi, yorumda duruyor -- burada calissaydi
  // clampStats'in ALANLAR ARASI kirpmasini geri alirdi:
  //   out.winStreak = safeInt(raw.winStreak, 0, 0);
  //   out.stats = { ...DEFAULT_SAVE.stats };
  //   const rawStats = raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats) ? raw.stats : {};
  //   for (const key of Object.keys(DEFAULT_SAVE.stats)) {
  //     out.stats[key] = safeInt(rawStats[key], 0, 0);
  //   }

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
