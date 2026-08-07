/**
 * DURUM DAYANIKLILIGI SINAVI — "kayitli durum GUVENILMEZ GIRDIDIR".
 *
 * Portfoyde yazili ders: kaydedilmis bayraga INANMA, TURET. Sekil dogrulamasi
 * yetmez; KURAL da dogrulanmalidir (progress <= target, tarih ILERI gitmis mi,
 * anchor gelecekte mi...).
 *
 * Her testin basindaki yorum, duzeltmeden ONCE olculen degeri yazar.
 * Testlerin kirmizi olmasi gereken hali mutasyon sinaviyla dogrulandi:
 * qa/mutasyon_durum.mjs
 *
 * KAPSAM DISI: gercek React reconciler, AsyncStorage'in kendi hatalari,
 * dokunma/animasyon, cihaz saat dilimi degisimleri.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Loader hook'lari ONCE calismali (AsyncStorage stub'i + uzantisiz import'lar),
// bu yuzden kaynak modulleri DINAMIK import ediliyor.
import "./qa_hooks.mjs";
import { loadComponent, renderDeep, collectText } from "./qa_mini_render.mjs";

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  sanitizeSave, sanitizeQuests, isValidQuest, deriveMaxLevel,
  evaluateDailyLogin, needsQuestRefresh, safeInt, localDateStr,
  loadProgress, saveProgress,
  // KAYIT ISTISMARI turu — yeni turetme/kirpma yardimcilari
  deriveMaxLevelZincirsiz, reachableProgress, levelWon, clampStats,
  maxReachableCoins, maxReachableBooster, computeStars,
} = await import("../src/utils/storage.js");
const { __clear } = await import("./qa_asyncstorage_stub.mjs");
const { settleLives, msUntilNextLife, formatMsClock, takeLife } =
  await import("../src/utils/lives.js");
const { ensureDailyQuests } = await import("../src/utils/quests.js");
const { checkUnlocks } = await import("../src/utils/achievements.js");
const { LIVES_MAX, LIFE_REGEN_MS, STARTER_COINS, QUEST_POOL, BOOSTER_DEFS } =
  await import("../src/constants/economy.js");
const { LEVELS } = await import("../src/constants/levels.js");

const QuestsModal = loadComponent(
  path.join(KOK, "src/components/DailyQuestsModal.js"),
).default;

const AppKaynak = fs.readFileSync(path.join(KOK, "App.js"), "utf8");

/** JSON'dan gelen kaydi taklit eder — `1e400` ancak boyle Infinity olur. */
const fromJson = (s) => JSON.parse(s);

/** Agac metnini tek boslukla normalize eder (Text dugumleri arasi bosluk degisken). */
function metinNormalize(parcalar) {
  return parcalar.join(" ").replace(/\s+/g, " ").trim();
}

/** Sabit bir gune kilitlenmis saat (quests.js iceriden localDateStr cagiriyor). */
function withFakeDay(dayStr, fn) {
  const RealDate = Date;
  const fixed = new RealDate(`${dayStr}T12:00:00`).getTime();
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() { return fixed; }
  }
  globalThis.Date = FakeDate;
  try { return fn(); } finally { globalThis.Date = RealDate; }
}

const gecerliGorev = (over = {}) => ({
  id: "win_levels", event: "win", desc: "Win 3 levels",
  target: 3, progress: 1, reward: 50, claimed: false, ...over,
});

/** QUEST_POOL'daki i. gorevin MESRU kaydi (quests.js:16-24 ne yaziyorsa o). */
function havuzGorevi(i, over = {}) {
  const q = QUEST_POOL[i];
  return {
    id: q.id, event: q.event, desc: q.desc.replace("{N}", String(q.target)),
    target: q.target, progress: 0, reward: q.reward, claimed: false, ...over,
  };
}

/** Seviye n'i `yildiz` yildizla kazanan oyuncunun yazacagi GERCEK skor. */
function kazanilanSkor(n, yildiz) {
  const lv = LEVELS[n - 1];
  return yildiz >= 3 ? lv.target3 : yildiz === 2 ? lv.target2 : lv.target1;
}

/** 1..n araligini MESRU OYUNLA tamamlamis bir kaydin ilerleme parcasi. */
function mesruIlerleme(n, yildiz = 1) {
  const stars = {};
  const highScores = {};
  for (let i = 1; i <= n; i++) {
    stars[i] = yildiz;
    highScores[i] = kazanilanSkor(i, yildiz);
  }
  return { stars, highScores };
}

// ===========================================================================
// BULGU 1 [ENGEL] — Bozuk kayit Daily Quests ekranini COKERTIYORDU
// ===========================================================================

test("BULGU 1: `dailyQuests:[1,2,3]` ekrani COKERTMEZ (gercek render)", () => {
  // ONCE: QuestRow govdesi `q.progress.toLocaleString()` cagiriyordu ->
  // TypeError: Cannot read properties of undefined (reading 'toLocaleString')
  const agac = renderDeep(QuestsModal, {
    visible: true, quests: [1, 2, 3], onClose() {},
  });
  const metin = metinNormalize(collectText(agac));
  assert.match(metin, /Daily Quests/);
  // Uc satir da cizilmis olmali (bos liste mesaji CIKMAMALI).
  assert.doesNotMatch(metin, /No quests today/);
  assert.equal((metin.match(/Daily quest/g) || []).length, 3);
});

test("BULGU 1: eksik alanli (eski surum) gorev cokertmez, NaN basmaz", () => {
  // ONCE: `progress` alani olmayan gorev kabul ediliyordu; applyQuestEvents
  // progress'i NaN yapiyor ve gorev `NaN >= target` yuzunden SONSUZA KADAR
  // tamamlanamiyordu. Ekranda da NaN goruluyordu.
  const agac = renderDeep(QuestsModal, {
    visible: true,
    quests: [{ id: "eski", desc: "Win 3 levels", target: 3, reward: 50 }],
    onClose() {},
  });
  const metin = metinNormalize(collectText(agac));
  assert.doesNotMatch(metin, /NaN/);
  assert.match(metin, /0 \/ 3/);
});

test("BULGU 1: null/metin/nesne gibi dizi OLMAYAN quests degeri cokertmez", () => {
  for (const bozuk of [null, undefined, "abc", 42, { a: 1 }]) {
    const agac = renderDeep(QuestsModal, { visible: true, quests: bozuk, onClose() {} });
    const metin = metinNormalize(collectText(agac));
    assert.match(metin, /No quests today/, `girdi=${JSON.stringify(bozuk)}`);
  }
});

test("BULGU 1: metin/negatif/asiri progress ekranda SAYIYA zorlanir", () => {
  const agac = renderDeep(QuestsModal, {
    visible: true,
    quests: [
      gecerliGorev({ id: "a", progress: "5", target: 10, desc: "Metin progress" }),
      gecerliGorev({ id: "b", progress: -7, target: 10, desc: "Negatif progress" }),
      gecerliGorev({ id: "c", progress: 999, target: 10, desc: "Asiri progress" }),
    ],
    onClose() {},
  });
  const metin = metinNormalize(collectText(agac));
  assert.match(metin, /5 \/ 10/, "metin '5' sayiya donmeli");
  assert.match(metin, /0 \/ 10/, "negatif 0'a kirpilmali");
  assert.match(metin, /10 \/ 10/, "asiri deger target'a kirpilmali");
  assert.doesNotMatch(metin, /NaN|-7|999/);
});

test("BULGU 1: bozuk gorev listesi YUKLEMEDE eleniyor -> gun yeniden uretilir", () => {
  // ONCE: storage.js `out.dailyQuests = saved.dailyQuests || []` — icerik hic
  // bakilmadan geciyordu; quests.js sadece `length===3` + tarih soruyordu.
  const s = sanitizeSave({
    dailyQuests: [1, 2, 3],
    lastQuestRefreshDateStr: "2026-08-07",
  });
  assert.deepEqual(s.dailyQuests, []);
  assert.equal(s.lastQuestRefreshDateStr, "", "tarih de dusmeli ki gun yeniden uretilsin");
  assert.equal(needsQuestRefresh(s, "2026-08-07"), true);
});

test("BULGU 1: gorev KURALI da dogrulanir (progress > target GECERSIZ)", () => {
  assert.equal(isValidQuest(gecerliGorev()), true);
  assert.equal(isValidQuest(gecerliGorev({ progress: 9, target: 3 })), false, "progress>target");
  assert.equal(isValidQuest(gecerliGorev({ target: 0 })), false, "target 0");
  assert.equal(isValidQuest(gecerliGorev({ claimed: "yes" })), false, "claimed bool degil");
  assert.equal(isValidQuest(gecerliGorev({ progress: undefined })), false, "eksik alan");
  assert.equal(isValidQuest(1), false);
  // Tek bozuk gorev TUM listeyi dusurur (yarim gun uretilmez).
  assert.deepEqual(sanitizeQuests([gecerliGorev(), gecerliGorev({ id: "x" }), 3]), []);
  // KONTROL: HAVUZDA GERCEKTEN OLAN iki gorev aynen gecer (asiri eleme yok).
  assert.equal(sanitizeQuests([havuzGorevi(0), havuzGorevi(1)]).length, 2);
});

// ===========================================================================
// BULGU 2 [ONEMLI] — Kilitli seviye kayittan aciliyordu
// ===========================================================================

test("BULGU 2: `maxLevel:999` kayittan seviye ACMAZ (turetiliyor)", () => {
  // ONCE: LevelSelectScreen'in `num <= save.maxLevel` kurali 30/30 seviyeyi
  // aciyordu, kazanilmis yildiz 0 iken.
  assert.equal(sanitizeSave({ maxLevel: 999 }).maxLevel, 1);
  assert.equal(sanitizeSave(fromJson('{"maxLevel":1e400}')).maxLevel, 1, "Infinity");
  assert.equal(sanitizeSave({ maxLevel: "30" }).maxLevel, 1, "metin");
  assert.equal(sanitizeSave({ maxLevel: -5 }).maxLevel, 1, "negatif -> oynanamaz kayit");
  assert.equal(sanitizeSave({}).maxLevel, 1);
});

test("BULGU 2: maxLevel KAZANILMIS ilerlemeden turetilir (zincirle)", () => {
  // Kural: GameScreen `won = score >= target1`, yani kazanilan seviye >= 1 yildiz.
  // 2. TUR NOTU: artik tek anahtar degil, 1'den baslayan KESINTISIZ ZINCIR
  // okunuyor (bkz. BULGU 7) — asagidaki vakalar o zincire gore yazildi.
  const iki = mesruIlerleme(2, 3);
  assert.equal(sanitizeSave({ ...iki, maxLevel: 1 }).maxLevel, 3);
  assert.equal(sanitizeSave(mesruIlerleme(5, 1)).maxLevel, 6);
  assert.equal(sanitizeSave({ stars: { 1: 0 } }).maxLevel, 1, "0 yildiz = kazanilmamis");
  assert.equal(deriveMaxLevel(mesruIlerleme(7, 2).stars, mesruIlerleme(7, 2).highScores), 8);
  // Aralik disi anahtarlar sizmaz.
  assert.equal(sanitizeSave({ stars: { 999: 3 } }).maxLevel, 1);
  const tam = mesruIlerleme(LEVELS.length, 3);
  assert.equal(sanitizeSave(tam).maxLevel, LEVELS.length,
    "son seviyeyi gecince maxLevel LEVELS.length'i ASMAZ");
  assert.equal(deriveMaxLevel(mesruIlerleme(4, 1).stars, mesruIlerleme(4, 1).highScores) <= LEVELS.length, true);
});

test("BULGU 2: mesru ilerleme KAYBOLMUYOR (regresyon)", () => {
  const mesru = {
    maxLevel: 4,
    stars: { 1: 3, 2: 2, 3: 1 },
    // MESRU skorlar: her biri o seviyenin yildiz esigini GERCEKTEN gecmis.
    highScores: { 1: kazanilanSkor(1, 3), 2: kazanilanSkor(2, 2), 3: kazanilanSkor(3, 1) },
    coins: 320, lives: 3, winStreak: 2,
    stats: { lifetimeWins: 3, lifetimeMatches: 140, bestWinStreak: 2, lifetimeCoinsEarned: 900 },
    inventory: { shuffle: 2 }, achievements: { first_match: true },
  };
  const s = sanitizeSave(mesru);
  assert.equal(s.maxLevel, 4);
  assert.equal(s.coins, 320);
  assert.equal(s.lives, 3);
  assert.equal(s.winStreak, 2);
  assert.equal(s.stats.lifetimeWins, 3);
  assert.equal(s.stats.lifetimeMatches, 140);
  assert.equal(s.inventory.shuffle, 2);
  assert.equal(s.achievements.first_match, true);
  assert.deepEqual(s.stars, { 1: 3, 2: 2, 3: 1 });
  assert.deepEqual(s.highScores, mesru.highScores, "skor tablosu da aynen kalmali");
});

// ===========================================================================
// BULGU 3 [ONEMLI] — Cuzdan tipi dogrulanmiyordu
// ===========================================================================

test("BULGU 3: metin coins TOPLANIR, birlestirilmez", () => {
  // ONCE: App.js:88 `prev.coins + reward.coins` -> "50" + 25 = "5025" (metin),
  // handleBuyBooster'in `<` kapisi metin karsilastirmasinda geciyordu.
  const s = sanitizeSave({ coins: "50" });
  assert.equal(typeof s.coins, "number");
  assert.equal(s.coins, 50);
  assert.equal(s.coins + 25, 75, "birlestirme olsaydi '5025' olurdu");
});

test("BULGU 3: `1e400` / negatif / bozuk cuzdan degerleri elenir", () => {
  assert.equal(Number.isFinite(sanitizeSave(fromJson('{"coins":1e400}')).coins), true);
  assert.equal(sanitizeSave({ coins: -999 }).coins, 0, "negatif dukkani kilitliyordu");
  assert.equal(sanitizeSave({ coins: "abc" }).coins, STARTER_COINS);
  assert.equal(sanitizeSave({ coins: null }).coins, STARTER_COINS);
  assert.equal(sanitizeSave({ coins: 12.7 }).coins, 12, "kesirli coin yok");
});

test("BULGU 3: lives / stats / inventory de sayiya zorlanir", () => {
  assert.equal(sanitizeSave({ lives: 99 }).lives, LIVES_MAX);
  assert.equal(sanitizeSave({ lives: -3 }).lives, 0);
  // 2. TUR DUZELTMESI (bkz. BULGU 14): BOZUK deger artik tam can ODULU DEGIL.
  assert.equal(sanitizeSave({ lives: "abc" }).lives, 0);
  assert.equal(sanitizeSave(fromJson('{"lives":1e400}')).lives, 0);
  assert.equal(sanitizeSave({}).lives, LIVES_MAX, "KONTROL: alan YOKSA yeni oyuncu");
  assert.equal(sanitizeSave({ lives: null }).lives, LIVES_MAX, "KONTROL: null = alan yok");

  const s = sanitizeSave({ stats: { lifetimeWins: "7", lifetimeMatches: -4, bestCascadeLevel: null } });
  assert.equal(s.stats.lifetimeWins, 7);
  assert.equal(s.stats.lifetimeMatches, 0);
  assert.equal(s.stats.bestCascadeLevel, 0);
  for (const [k, v] of Object.entries(s.stats)) {
    assert.equal(Number.isFinite(v), true, `stats.${k} sonlu sayi olmali`);
  }

  // 2. TUR NOTU: envanter artik ULASILABILIR sayiya da kirpiliyor (BULGU 12),
  // o yuzden 3 shuffle icin 3x50 coin'lik bir kazanc gecmisi gerekiyor.
  assert.equal(sanitizeSave({ inventory: { shuffle: "3", hammer: -1 },
    stats: { lifetimeCoinsEarned: 500 } }).inventory.shuffle, 3);
  assert.equal(sanitizeSave({ inventory: { hammer: -1 } }).inventory.hammer, 0);
  // Basarim bayragi yalnizca GERCEK true kabul edilir.
  assert.deepEqual(sanitizeSave({ achievements: { a: 1, b: "true", c: true } }).achievements, { c: true });
});

test("BULGU 3: hicbir girdi sekli sanitizeSave'i COKERTMEZ", () => {
  const payloads = [
    null, undefined, 0, "", "duz metin", [], [1, 2, 3], { stats: 5 }, { stars: "x" },
    { inventory: null }, { achievements: [1] }, fromJson('{"coins":1e400,"maxLevel":1e400}'),
    { lastLifeRegenMs: "yarin" }, { loginDay: 99 }, { dailyQuests: {} },
  ];
  for (const p of payloads) {
    const s = sanitizeSave(p);
    assert.equal(Number.isFinite(s.coins), true, `coins bozuk: ${JSON.stringify(p)}`);
    assert.equal(Number.isInteger(s.maxLevel) && s.maxLevel >= 1, true);
    assert.equal(Array.isArray(s.dailyQuests), true);
    assert.equal(s.loginDay >= 0 && s.loginDay <= 7, true);
  }
  assert.equal(safeInt("12abc", 5, 0, 100), 5, "yari-sayi metin fallback'e duser");
});

// ===========================================================================
// BULGU 4 [ONEMLI] — Gece yarisi devri yoktu
// ===========================================================================

test("BULGU 4: dunun gorevleri BUGUN gecersizdir (needsQuestRefresh)", () => {
  const dun = {
    lastQuestRefreshDateStr: "2026-08-06",
    // Gorevler HAVUZDAN gelmeli, yoksa yenileme zaten BULGU 11 yuzunden tetiklenir
    // ve bu test tarih kuralini olcmus olmaz.
    dailyQuests: [havuzGorevi(0), havuzGorevi(1), havuzGorevi(2)],
  };
  assert.equal(needsQuestRefresh(dun, "2026-08-07"), true);
  assert.equal(needsQuestRefresh({ ...dun, lastQuestRefreshDateStr: "2026-08-07" }, "2026-08-07"), false);
  // Sayi dogru ama icerik bozuksa yine yenilenir.
  assert.equal(needsQuestRefresh({ lastQuestRefreshDateStr: "2026-08-07", dailyQuests: [1, 2, 3] }, "2026-08-07"), true);
  assert.equal(needsQuestRefresh({ lastQuestRefreshDateStr: "2026-08-07", dailyQuests: [] }, "2026-08-07"), true);
});

test("BULGU 4: gun donunce gorevler GERCEKTEN yenilenir (sahte saat)", () => {
  const gun1 = withFakeDay("2026-08-07", () => ensureDailyQuests(sanitizeSave({})));
  assert.equal(gun1.dailyQuests.length, 3);
  assert.equal(gun1.lastQuestRefreshDateStr, "2026-08-07");

  // Gunu tamamla (hepsi claimed) — eski kodda oyuncu bunlari ERTESI GUN de goruyordu.
  const bitmis = {
    ...gun1,
    dailyQuests: gun1.dailyQuests.map((q) => ({ ...q, progress: q.target, claimed: true })),
  };
  const gun2 = withFakeDay("2026-08-08", () => ensureDailyQuests(bitmis));
  assert.equal(gun2.lastQuestRefreshDateStr, "2026-08-08");
  assert.equal(gun2.dailyQuests.every((q) => q.progress === 0 && q.claimed === false), true,
    "yeni gunun gorevleri sifirdan baslamali");
});

test("BULGU 4: App.js gunu SADECE mount'ta degil, AppState + tik ile de degerlendirir", () => {
  // ONCE: iki useEffect'in de deps'i `[]` idi ve depoda AppState HIC YOKTU
  // (`grep -rn AppState src App.js index.js` -> 0 eslesme).
  assert.match(AppKaynak, /import\s*\{[^}]*\bAppState\b[^}]*\}\s*from\s*'react-native'/,
    "AppState react-native'den import edilmeli");
  assert.match(AppKaynak, /AppState\.addEventListener\(\s*'change'/,
    "AppState 'change' dinleyicisi kurulmali");
  assert.match(AppKaynak, /state === 'active'/,
    "yalnizca one gelince degerlendirilmeli");
  assert.match(AppKaynak, /setInterval\(\s*refresh/,
    "periyodik tik de gun degisimini yakalamali (uygulama acikken gece yarisi)");
  assert.match(AppKaynak, /setDayStr\(\(d\) => \{[\s\S]*?localDateStr\(\)/,
    "tik/AppState gun dizesini tazelemeli");
  assert.match(AppKaynak, /\}, \[dayStr, save\]\)/,
    "devir efekti gun degisimine bagli olmali — `[]` degil");
  assert.match(AppKaynak, /needsQuestRefresh\(next, dayStr\)/);
  assert.match(AppKaynak, /evaluateDailyLogin\(next, dayStr\)/);
  assert.match(AppKaynak, /sub\.remove/, "dinleyici temizlenmeli (sizinti yok)");
});

// ===========================================================================
// BULGU 5 [KUCUK] — Gunluk giris odulu cihaz saatiyle tekrar alinabiliyordu
// ===========================================================================

test("BULGU 5: saat GERI alinirsa odul YENIDEN verilmez", () => {
  // ONCE: tek olcut `s.lastLoginDateStr !== today` (ESITSIZLIK) idi; geri
  // alinan tarihte de saglaniyordu. Olculdu: 08-07 <-> 08-06 arasi 5 acilis
  // = 175 coin, dongu sonsuz.
  const s = { lastLoginDateStr: "2026-08-07", loginDay: 3 };
  assert.equal(evaluateDailyLogin(s, "2026-08-07").showModal, false, "ayni gun");
  assert.equal(evaluateDailyLogin(s, "2026-08-06").showModal, false, "1 gun geri");
  assert.equal(evaluateDailyLogin(s, "2025-01-01").showModal, false, "1.5 yil geri");
  assert.equal(evaluateDailyLogin(s, "2026-08-08").showModal, true, "ileri gun ODUL VERIR");
});

test("BULGU 5: 08-07 <-> 08-06 arasi 5 acilis SADECE 1 odul verir", () => {
  // Bulgunun kanit kosumunun birebir tekrari: once 175 coin cikiyordu.
  const gunler = ["2026-08-07", "2026-08-06", "2026-08-07", "2026-08-06", "2026-08-07"];
  let save = sanitizeSave({ lastLoginDateStr: "2026-08-06", loginDay: 1 });
  let odulSayisi = 0;
  const verilenGunler = [];
  for (const g of gunler) {
    const d = evaluateDailyLogin(save, g);
    if (d.showModal) {
      odulSayisi++;
      verilenGunler.push(d.nextDay);
      // claimDailyLogin'in monoton kurali: tarih GERIYE gitmez.
      const claimedOn = save.lastLoginDateStr > g ? save.lastLoginDateStr : g;
      save = { ...save, loginDay: d.nextDay, lastLoginDateStr: claimedOn };
    }
  }
  assert.equal(odulSayisi, 1, `beklenen 1 odul, verilen ${odulSayisi} (${verilenGunler})`);
  assert.deepEqual(verilenGunler, [2], "streak dogru ilerlemeli");
  assert.equal(save.lastLoginDateStr, "2026-08-07", "en yuksek gun korunmali");
});

test("BULGU 5: mesru streak mantigi BOZULMADI (regresyon)", () => {
  assert.deepEqual(
    evaluateDailyLogin({ lastLoginDateStr: "", loginDay: 0 }, "2026-08-07"),
    { showModal: true, nextDay: 1, daysSince: Infinity }, "ilk acilis",
  );
  assert.equal(evaluateDailyLogin({ lastLoginDateStr: "2026-08-06", loginDay: 3 }, "2026-08-07").nextDay, 4);
  assert.equal(evaluateDailyLogin({ lastLoginDateStr: "2026-08-06", loginDay: 7 }, "2026-08-07").nextDay, 1, "7'den sonra basa");
  assert.equal(evaluateDailyLogin({ lastLoginDateStr: "2026-08-01", loginDay: 3 }, "2026-08-07").nextDay, 1, "seri kirildi");
  // Bozuk tarih dizesi ilk acilis gibi ele alinir, cokmez.
  assert.equal(evaluateDailyLogin({ lastLoginDateStr: "yarin", loginDay: 3 }, "2026-08-07").showModal, true);
  assert.equal(evaluateDailyLogin(null, localDateStr()).showModal, true);
});

test("BULGU 5: claimDailyLogin tarihi GERIYE tasimaz (App.js kapisi)", () => {
  assert.match(AppKaynak, /prev\.lastLoginDateStr > dayStr/,
    "claim, gorulmus en yuksek gunu korumali");
  assert.match(AppKaynak, /\? prev\.lastLoginDateStr\s+: dayStr/,
    "kosul dogruyken ESKI (daha yuksek) tarih korunmali");
  assert.doesNotMatch(AppKaynak, /lastLoginDateStr: localDateStr\(\)/,
    "claim aninda yeniden saat okunmamali (yaris + geri alma yolu)");
});

// ===========================================================================
// BULGU 6 [KUCUK] — Saat geri alininca can rejenerasyonu kilitleniyordu
// ===========================================================================

test("BULGU 6: gelecege ayarli anchor rejenerasyonu KILITLEMEZ", () => {
  // ONCE: {lives:0, anchor: now + 30 gun} -> lives 0'da kilitli, anchor
  // degismiyor, cikis yolu yok.
  const now = 1_800_000_000_000;
  const gelecek = { lives: 0, lastLifeRegenMs: now + 30 * 24 * 60 * 60 * 1000 };

  const s = settleLives(gelecek, now);
  assert.equal(s.lastLifeRegenMs <= now, true, `anchor kirpilmali, gelen: ${s.lastLifeRegenMs}`);
  assert.equal(s.lives, 0);

  // Kirpilmis anchor kaydedildikten sonra 20 dk'da can gelmeli.
  const sonra = settleLives({ ...gelecek, ...s }, now + LIFE_REGEN_MS);
  assert.equal(sonra.lives, 1, "20 dk sonra 1 can gelmeli");
  assert.notEqual(takeLife({ ...gelecek, ...s }, now + LIFE_REGEN_MS), null,
    "oyuncu artik seviye acabilmeli");
});

test("BULGU 6: geri sayim 20:00'i ASAMAZ — '43220:00' imkansiz", () => {
  const now = 1_800_000_000_000;
  const ms = msUntilNextLife({ lives: 0, lastLifeRegenMs: now + 30 * 24 * 60 * 60 * 1000 }, now);
  assert.equal(ms <= LIFE_REGEN_MS, true, `beklenen <= ${LIFE_REGEN_MS}, gelen ${ms}`);
  assert.equal(formatMsClock(ms), "20:00");
  assert.notEqual(formatMsClock(ms), "43220:00");
  // Normal yol bozulmadi.
  assert.equal(formatMsClock(msUntilNextLife({ lives: 2, lastLifeRegenMs: now - 5 * 60_000 }, now)), "15:00");
  assert.equal(msUntilNextLife({ lives: LIVES_MAX, lastLifeRegenMs: now }, now), 0);
});

test("BULGU 6: bozuk can/anchor degerleri settleLives'i sasirtmaz", () => {
  const now = 1_800_000_000_000;
  // 2. TUR DUZELTMESI (BULGU 14): bozuk deger 0 can, alan yoklugu LIVES_MAX.
  assert.equal(settleLives({ lives: "abc", lastLifeRegenMs: now }, now).lives, 0);
  assert.equal(settleLives({ lastLifeRegenMs: now }, now).lives, LIVES_MAX, "KONTROL");
  assert.equal(settleLives({ lives: 99, lastLifeRegenMs: now }, now).lives, LIVES_MAX);
  assert.equal(settleLives({ lives: -4, lastLifeRegenMs: now - LIFE_REGEN_MS }, now).lives, 1);
  assert.equal(settleLives({ lives: 0, lastLifeRegenMs: NaN }, now).lastLifeRegenMs, now);
  // Yukleme de gelecege ayarli anchor'i kirpar (ikinci katman).
  const s = sanitizeSave({ lives: 0, lastLifeRegenMs: now + 999_999_999 }, now);
  assert.equal(s.lastLifeRegenMs <= now, true);
});

// ===========================================================================
// UCTAN UCA: bozuk kaydi yukle -> gunu devret -> ekrani ciz
// ===========================================================================

test("UCTAN UCA: MESRU kayit kaydet->yukle turunda HICBIR SEY kaybetmez", async () => {
  // Dogrulayici bir SIZDIRMAZLIK degil, bir KAPIDIR: gercek oyuncunun verisi
  // aynen geri gelmeli. `event` alani ozellikle onemli — applyQuestEvents ona
  // bakiyor, isValidQuest ise onu sormuyor.
  __clear();
  let s = await loadProgress();
  s = withFakeDay("2026-08-07", () => ensureDailyQuests(s));
  s = {
    ...s,
    // MESRU kayit: skorlar yildizlarla tutarli, para kazanilandan az,
    // seri en iyi seriyi asmiyor (hepsi App.js'in yazdigi bicimde).
    stars: { 1: 3, 2: 2 },
    highScores: { 1: kazanilanSkor(1, 3), 2: kazanilanSkor(2, 2) },
    maxLevel: 3,
    coins: 412, lives: 2, winStreak: 2,
    stats: { ...s.stats, lifetimeMatches: 140, lifetimeWins: 2, bestWinStreak: 2, lifetimeCoinsEarned: 900 },
    inventory: { shuffle: 1 }, achievements: { first_match: true },
    loginDay: 3, lastLoginDateStr: localDateStr(),
  };
  await saveProgress(s);
  const geri = await loadProgress();

  for (const alan of ["maxLevel", "coins", "lives", "winStreak", "loginDay",
    "lastLoginDateStr", "lastQuestRefreshDateStr"]) {
    assert.equal(geri[alan], s[alan], `${alan} kaybedildi`);
  }
  assert.deepEqual(geri.stars, s.stars);
  assert.deepEqual(geri.inventory, s.inventory);
  assert.deepEqual(geri.achievements, s.achievements);
  assert.deepEqual(geri.dailyQuests, s.dailyQuests);
  assert.equal(geri.dailyQuests.every((q) => typeof q.event === "string"), true,
    "`event` alani korunmali, yoksa gorevler bir daha ilerlemez");
  __clear();
});

// ===========================================================================
// 2. TUR — KAYIT ISTISMARI. Bir onceki tur `maxLevel`i TURETMEYE cevirdi;
// dogrulama ajani bunun istismari KAPATMADIGINI, sadece BIR ALAN OTEYE
// TASIDIGINI olctu (qa/dusman_kayit.mjs -> 55 vakanin 13'u KIRIK).
// Ortak kok: yukleme TIP koruyordu, ALANLAR ARASI KURALA bakmiyordu.
// Yeni olcut: "bu duruma MESRU OYUNLA ULASILABILIR MI?"
// ===========================================================================

test("BULGU 7 [ENGEL]: stars/highScores yazarak seviye ACILMAZ (zincir kurali)", () => {
  // OLCULDU (once): {"stars":{"30":3}} -> maxLevel 30 (30/30 seviye acildi)
  //                 {"highScores":{"29":1}} -> maxLevel 30 (TEK puan yetti)
  assert.equal(sanitizeSave({ stars: { 30: 3 } }).maxLevel, 1);
  assert.equal(sanitizeSave({ highScores: { 29: 1 } }).maxLevel, 1);
  assert.equal(sanitizeSave({ stars: { 30: 3 }, highScores: { 30: 99999 } }).maxLevel, 1,
    "ikisi birden yazilsa bile 1..29 zinciri yok");

  // Eski turetme hala dosyada duruyor: farki BURADA olculuyor.
  assert.equal(deriveMaxLevelZincirsiz({ 30: 3 }, {}), 30, "eski kural 30 veriyordu");
  assert.equal(deriveMaxLevel({ 30: 3 }, {}), 1, "yeni kural zinciri ariyor");

  // Zincirin ORTASI kopuksa ulasilabilir en yuksek noktaya KIRPILIR.
  const delik = mesruIlerleme(5, 2);
  delik.stars[20] = 3;
  delik.highScores[20] = kazanilanSkor(20, 3);
  const s = sanitizeSave(delik);
  assert.equal(s.maxLevel, 6, "1..5 saglam, 20 ulasilamaz -> 6'ya kirpilir");
  assert.equal(s.stars[20], undefined, "ulasilamaz kayit dusuruldu");
  assert.equal(s.highScores[20], undefined);
  assert.deepEqual(Object.keys(s.stars), ["1", "2", "3", "4", "5"]);
});

test("BULGU 7 KONTROL: MESRU zincir hicbir sey KAYBETMEZ", () => {
  // Ters yon sinavi: kirpma dogruysa gercek oyuncunun ilerlemesi AYNEN kalmali.
  // (Ozelligi tamamen oldurmek de "istismar kapandi" gorunurdu.)
  for (const n of [1, 5, 15, LEVELS.length]) {
    const mesru = mesruIlerleme(n, 3);
    const s = sanitizeSave(mesru);
    assert.equal(s.maxLevel, Math.min(LEVELS.length, n + 1), `${n} seviye kazanilmis`);
    assert.equal(Object.keys(s.stars).length, n, `${n} seviyenin yildizi durmali`);
    assert.deepEqual(s.highScores, Object.fromEntries(
      Object.entries(mesru.highScores).map(([k, v]) => [k, v])), "skorlar aynen");
  }
  // "sev 30 kazanilmis -> maxLevel 30" regresyon vakasi (MESRU haliyle):
  assert.equal(sanitizeSave(mesruIlerleme(LEVELS.length, 1)).maxLevel, LEVELS.length);
  // "stars 1..5 kazanilmis -> maxLevel 6" regresyon vakasi:
  assert.equal(sanitizeSave(mesruIlerleme(5, 1)).maxLevel, 6);
  // levelWon tek tek de dogru: kanit yoksa false, varsa true.
  assert.equal(levelWon(1, {}, {}), false);
  assert.equal(levelWon(1, {}, { 1: kazanilanSkor(1, 1) }), true);
  assert.equal(levelWon(LEVELS.length + 1, {}, { [LEVELS.length + 1]: 99999 }), false,
    "olmayan seviye kazanilamaz");
});

test("BULGU 8 [ONEMLI]: yildiz PUANDAN turetilir, kayittan okunmaz", () => {
  // OLCULDU: stars[1]=3 ama highScores[1]=1 -> 3 yildiz kabul ediliyordu
  // (3 yildiz LEVELS[0].target3 = 21500 puan ister).
  const s = sanitizeSave({ stars: { 1: 3 }, highScores: { 1: 1 } });
  assert.equal(s.stars["1"], undefined, "1 puan yildiz vermez");
  assert.equal(s.highScores["1"], 1, "skor kaydi silinmez, yildiz KIRPILIR");

  // KONTROL: puan gercekten yetiyorsa 3 yildiz AYNEN durur.
  const iyi = sanitizeSave({ stars: { 1: 3 }, highScores: { 1: kazanilanSkor(1, 3) } });
  assert.equal(iyi.stars["1"], 3);
  assert.equal(computeStars(kazanilanSkor(1, 3), LEVELS[0]), 3);
  // KONTROL 2: yildiz alani HIC yazilmamis ama puan yeterliyse yildiz TURETILIR.
  const turetilen = sanitizeSave({ highScores: { 1: kazanilanSkor(1, 2) } });
  assert.equal(turetilen.stars["1"], 2);
  assert.equal(reachableProgress({}, { 1: kazanilanSkor(1, 2) }).maxLevel, 2);
});

test("BULGU 9 [ONEMLI]: para KAZANILANDAN fazla olamaz", () => {
  // OLCULDU: {"coins":999999999,"stats":{"lifetimeCoinsEarned":0}} aynen kabul.
  assert.equal(sanitizeSave({ coins: 999999999, stats: { lifetimeCoinsEarned: 0 } }).coins,
    STARTER_COINS);
  assert.equal(sanitizeSave({ coins: 999999999, stats: { lifetimeCoinsEarned: 900 } }).coins,
    STARTER_COINS + 900);
  assert.equal(maxReachableCoins({ lifetimeCoinsEarned: 900 }), STARTER_COINS + 900);

  // KONTROL: mesru para AYNEN kalir (asiri kirpma yok).
  assert.equal(sanitizeSave({ coins: 320, stats: { lifetimeCoinsEarned: 900 } }).coins, 320);
  // KONTROL 2: yeni oyuncunun baslangic parasi silinmez.
  assert.equal(sanitizeSave({}).coins, STARTER_COINS);
  assert.equal(sanitizeSave({ coins: STARTER_COINS }).coins, STARTER_COINS);
});

test("BULGU 10 [ENGEL]: sisirilmis stats / `false` basarim BEDAVA PARA VERMEZ", () => {
  // OLCULDU: uydurma stats -> checkUnlocks 5 basarim + 310 coin;
  //          achievements[*]=false yazmak ayni 310 coin'i HER YUKLEMEDE tekrar
  //          odetiyordu (sonsuz para dongusu).
  const sisirilmis = sanitizeSave({
    stats: {
      lifetimeMatches: 1, lifetimeCascadesBig: 99, lifetimeColorBombs: 99,
      lifetimeCoinsEarned: 99999, bestWinStreak: 99,
    },
    achievements: {},
  });
  assert.equal(checkUnlocks(sisirilmis).rewardCoins, 0, "bedava basarim parasi YOK");
  // Alanlar arasi kirpma gercekten uygulanmis mi?
  assert.equal(sisirilmis.stats.lifetimeCascadesBig, 1, "4x kademe <= eslesme");
  assert.equal(sisirilmis.stats.lifetimeColorBombs, 0, "bomba <= uretilen ozel seker");
  assert.equal(sisirilmis.stats.bestWinStreak, 0, "seri <= galibiyet");

  // `false` yazarak odulu tekrar alma yolu: bayrak yuklemede TURETILIYOR.
  const tekrar = sanitizeSave({
    stats: { lifetimeMatches: 500, lifetimeSpecialsMade: 60, lifetimeCascadesBig: 50,
             lifetimeColorBombs: 50, lifetimeCoinsEarned: 5000, lifetimeWins: 9, bestWinStreak: 9 },
    achievements: { first_match: false, cascade_master: false, coin_hoarder: false },
  });
  assert.equal(checkUnlocks(tekrar).rewardCoins, 0, "ikinci kez odenmez");
  assert.equal(tekrar.achievements.first_match, true, "kosul saglaniyorsa bayrak ACIK");
  assert.equal(tekrar.achievements.cascade_master, true);

  // KONTROL: MESRU istatistikler AYNEN kalir, kirpilmaz.
  const mesru = sanitizeSave({
    stats: { lifetimeMatches: 500, lifetimeSpecialsMade: 60, lifetimeCascadesBig: 50,
             lifetimeColorBombs: 12, lifetimeCoinsEarned: 5000, lifetimeWins: 9,
             bestWinStreak: 5, bestCascadeLevel: 6 },
  });
  assert.equal(mesru.stats.lifetimeCascadesBig, 50);
  assert.equal(mesru.stats.lifetimeColorBombs, 12);
  assert.equal(mesru.stats.bestWinStreak, 5);
  assert.equal(mesru.stats.bestCascadeLevel, 6);
  assert.deepEqual(clampStats({ lifetimeMatches: 10, lifetimeSpecialsMade: 4, lifetimeColorBombs: 2 }).lifetimeColorBombs, 2);
  // KONTROL 2: mesru olarak acilmis bir basarim KAYBOLMAZ.
  assert.equal(sanitizeSave({ achievements: { level_10: true } }).achievements.level_10, true);
});

test("BULGU 11 [ENGEL]: gorev HAVUZA karsi dogrulanir (uydurma odul odenmez)", () => {
  const uydurma = [0, 1, 2].map((i) => ({
    id: `para_basmaca${i}`, event: "win", desc: "x",
    target: 1, progress: 0, reward: 999999999, claimed: false,
  }));
  assert.deepEqual(sanitizeQuests(uydurma), [], "havuzda olmayan id");
  assert.deepEqual(sanitizeQuests([havuzGorevi(0, { reward: 500000 })]), [], "sisirilmis odul");
  assert.deepEqual(sanitizeQuests([havuzGorevi(0, { target: 1 })]), [], "kolaylastirilmis hedef");
  assert.deepEqual(sanitizeQuests([havuzGorevi(0, { event: undefined })]), [],
    "`event` YOKSA gorev gun boyu ILERLEMEZ -- olu gun");
  assert.deepEqual(sanitizeQuests([havuzGorevi(0), havuzGorevi(0)]), [],
    "ayni gorev iki kez odenemez");
  // Uydurma liste 'taze' sayilip gunun yenilenmesini de engellemez.
  const s = sanitizeSave({ dailyQuests: uydurma, lastQuestRefreshDateStr: "2026-08-07" });
  assert.equal(needsQuestRefresh(s, "2026-08-07"), true);

  // KONTROL: quests.js'in URETTIGI gerçek gun AYNEN gecer.
  const gun = withFakeDay("2026-08-07", () => ensureDailyQuests(sanitizeSave({})));
  assert.equal(sanitizeQuests(gun.dailyQuests).length, 3, "mesru gun elenmemeli");
  assert.equal(gun.dailyQuests.every(isValidQuest), true);
  assert.equal(needsQuestRefresh(sanitizeSave(gun), "2026-08-07"), false);
  // Ilerlemis/tamamlanmis mesru gorev de gecerlidir.
  assert.equal(isValidQuest(havuzGorevi(0, { progress: QUEST_POOL[0].target, claimed: true })), true);
});

test("BULGU 12 [KUCUK]: envanter BOOSTER_DEFS ve ULASILABILIR sayiya kirpilir", () => {
  // OLCULDU: {"hammer":9999,"UYDURMA_BOOSTER":9999} aynen kabul ediliyordu
  // (9999 cekic = 999.900 coin'lik esya, UI'da gorunmeyen sessiz cop).
  const s = sanitizeSave({
    inventory: { hammer: 9999, UYDURMA_BOOSTER: 9999, shuffle: "7" },
    stats: { lifetimeCoinsEarned: 0 },
  });
  assert.equal("UYDURMA_BOOSTER" in s.inventory, false, "bilinmeyen booster elendi");
  assert.equal(s.inventory.hammer <= 100, true, `hammer=${s.inventory.hammer}`);
  assert.equal(maxReachableBooster("hammer", 0), 1);
  assert.equal(maxReachableBooster("UYDURMA_BOOSTER", 999999), 0);

  // KONTROL: mesru envanter AYNEN kalir.
  const mesru = sanitizeSave({ inventory: { shuffle: 2, hammer: 3 }, stats: { lifetimeCoinsEarned: 900 } });
  assert.equal(mesru.inventory.shuffle, 2);
  assert.equal(mesru.inventory.hammer, 3);
  assert.equal(maxReachableBooster("shuffle", 900) >= 2, true);
  assert.equal(Object.keys(BOOSTER_DEFS).every((id) => maxReachableBooster(id, 100000) > 0), true);
});

test("BULGU 13 [KUCUK]: GELECEK tarihli gunluk giris kaydi KILITLEMEZ", () => {
  // OLCULDU: lastLoginDateStr='2099-12-31' -> daysSince -26809 -> oyuncu
  // 2099'a kadar gunluk odul ALAMIYOR (kalici kilitlenme).
  const now = new Date("2026-08-07T12:00:00").getTime();
  const s = sanitizeSave({ lastLoginDateStr: "2099-12-31", loginDay: 7 }, now);
  assert.equal(s.lastLoginDateStr, "2026-08-07", "bugune kirpildi");
  assert.equal(evaluateDailyLogin(s, "2026-08-08").showModal, true, "kilit ACILDI");
  // KONTROL (BULGU 5 ile celismemeli): bugun BEDAVA ikinci odul dogmaz.
  assert.equal(evaluateDailyLogin(s, "2026-08-07").showModal, false);
  // KONTROL 2: GECMIS tarihe dokunulmaz.
  const g = sanitizeSave({ lastLoginDateStr: "2026-08-01", loginDay: 3 }, now);
  assert.equal(g.lastLoginDateStr, "2026-08-01");
  assert.equal(g.loginDay, 3);
  // KONTROL 3: tarihsiz seri olmaz (App.js ikisini birlikte yazar).
  assert.equal(sanitizeSave({ loginDay: 7 }, now).loginDay, 0);
});

test("BULGU 14 [KUCUK]: bozuk `lives` degeri TAM CAN odulu vermez", () => {
  const now = 1_800_000_000_000;
  // OLCULDU: settleLives({lives:"abc"}) -> 5, {lives:{}} -> 5, 1e400 -> 5.
  for (const bozuk of ["abc", {}, [], true, NaN, Infinity, "  "]) {
    assert.equal(settleLives({ lives: bozuk, lastLifeRegenMs: now }, now).lives, 0,
      `lives=${JSON.stringify(bozuk)}`);
  }
  assert.equal(msUntilNextLife({ lives: "abc", lastLifeRegenMs: now }, now) > 0, true,
    "bozuk can 'dolu' sayilip sayaci sifirlamaz");

  // KONTROL: alan YOKSA yeni oyuncu tam can alir; sayisal degerler bozulmaz.
  assert.equal(settleLives({ lastLifeRegenMs: now }, now).lives, LIVES_MAX);
  assert.equal(settleLives({ lives: null, lastLifeRegenMs: now }, now).lives, LIVES_MAX);
  assert.equal(settleLives({ lives: 3, lastLifeRegenMs: now }, now).lives, 3);
  assert.equal(settleLives({ lives: "3", lastLifeRegenMs: now }, now).lives, 3);
  assert.equal(msUntilNextLife({ lives: LIVES_MAX, lastLifeRegenMs: now }, now), 0);
});

test("BULGU 15 [KUCUK]: saat ILERI alinip GERI alininca can kazanmak durmaz", () => {
  // Senaryo: oyuncu saati 30 gun ileri aliyor (can dolduruyor), sonra geri
  // aliyor -> anchor GELECEKTE kaliyordu ve elapsed hep negatif oldugu icin
  // rejenerasyon bir daha calismiyordu.
  const now = 1_800_000_000_000;
  const ileri = now + 30 * 24 * 60 * 60 * 1000;

  // 1) Saat ileriyken oynanmis: takeLife anchor'i ileri tarihe yaziyor.
  const ileriKayit = takeLife({ lives: LIVES_MAX, lastLifeRegenMs: ileri }, ileri);
  assert.equal(ileriKayit.lives, LIVES_MAX - 1);

  // 2) Saat geri alindi -> yukleme anchor'i kirpiyor (birinci katman).
  const yuklenen = sanitizeSave({ lives: ileriKayit.lives, lastLifeRegenMs: ileriKayit.lastLifeRegenMs }, now);
  assert.equal(yuklenen.lastLifeRegenMs <= now, true);

  // 3) Kirpilmamis kayit dogrudan verilse bile lives.js kendi kirpmasini yapar
  //    (ikinci katman). DIKKAT: kirpma her cagrida `now`a gore yapildigi icin
  //    cikis yolu ancak KIRPILMIS ANCHOR YAZILDIKTAN sonra ilerler — App.js:210
  //    tam bunu yapiyor (settleLives -> saveProgress).
  const kirpilmis = settleLives({ lives: 0, lastLifeRegenMs: ileri }, now);
  assert.equal(kirpilmis.lastLifeRegenMs <= now, true);
  const sonra = settleLives(kirpilmis, now + LIFE_REGEN_MS);
  assert.equal(sonra.lives, 1);
  assert.equal(msUntilNextLife({ lives: 0, lastLifeRegenMs: ileri }, now) <= LIFE_REGEN_MS, true);
  // KONTROL: gecmisteki anchor bozulmadan calismaya devam ediyor.
  assert.equal(settleLives({ lives: 1, lastLifeRegenMs: now - 2 * LIFE_REGEN_MS }, now).lives, 3);
});

test("UCTAN UCA: elle bozulmus kayit yuklenir, gun devreder, ekran cizilir", () => {
  const bozuk = fromJson(JSON.stringify({
    maxLevel: 999, coins: "50", lives: 42, lastLifeRegenMs: 9e15,
    dailyQuests: [1, 2, 3], lastQuestRefreshDateStr: "2026-08-07",
    lastLoginDateStr: "2026-08-09", loginDay: 99,
    stats: { lifetimeWins: "x" }, stars: { 999: 3 },
  }));

  const s = withFakeDay("2026-08-07", () => {
    const temiz = sanitizeSave(bozuk);
    return ensureDailyQuests(temiz);
  });

  assert.equal(s.maxLevel, 1, "kilitli seviye acilmadi");
  assert.equal(s.coins, 50);
  assert.equal(s.lives, LIVES_MAX);
  assert.equal(s.loginDay, 7);
  assert.equal(s.stats.lifetimeWins, 0);
  assert.equal(s.dailyQuests.length, 3);
  assert.equal(s.dailyQuests.every(isValidQuest), true);

  // lastLoginDateStr GELECEKTE (2026-08-09) — bugun 08-07 -> odul YOK.
  assert.equal(evaluateDailyLogin(s, "2026-08-07").showModal, false);

  const metin = metinNormalize(collectText(renderDeep(QuestsModal, {
    visible: true, quests: s.dailyQuests, onClose() {},
  })));
  assert.doesNotMatch(metin, /NaN|undefined/);
  assert.match(metin, /0 \//);
});
