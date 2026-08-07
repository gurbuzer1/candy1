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
} = await import("../src/utils/storage.js");
const { __clear } = await import("./qa_asyncstorage_stub.mjs");
const { settleLives, msUntilNextLife, formatMsClock, takeLife } =
  await import("../src/utils/lives.js");
const { ensureDailyQuests } = await import("../src/utils/quests.js");
const { LIVES_MAX, LIFE_REGEN_MS, STARTER_COINS } =
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
  assert.equal(sanitizeQuests([gecerliGorev(), gecerliGorev({ id: "x" })]).length, 2);
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

test("BULGU 2: maxLevel KAZANILMIS yildiz/skordan turetilir", () => {
  // Kural: GameScreen `won = score >= target1`, yani kazanilan seviye >= 1 yildiz.
  assert.equal(sanitizeSave({ stars: { 1: 3, 2: 1 }, maxLevel: 1 }).maxLevel, 3);
  assert.equal(sanitizeSave({ stars: { 1: 3 }, highScores: { 5: 9999 } }).maxLevel, 6);
  assert.equal(sanitizeSave({ stars: { 1: 0 } }).maxLevel, 1, "0 yildiz = kazanilmamis");
  assert.equal(deriveMaxLevel({ 7: 2 }, {}), 8);
  // Aralik disi anahtarlar sizmaz.
  assert.equal(sanitizeSave({ stars: { 999: 3 } }).maxLevel, 1);
  assert.equal(sanitizeSave({ stars: { [LEVELS.length]: 3 } }).maxLevel, LEVELS.length,
    "son seviyeyi gecince maxLevel LEVELS.length'i ASMAZ");
  assert.equal(deriveMaxLevel({ 4: 1 }, {}) <= LEVELS.length, true);
});

test("BULGU 2: mesru ilerleme KAYBOLMUYOR (regresyon)", () => {
  const mesru = {
    maxLevel: 4, stars: { 1: 3, 2: 2, 3: 1 }, highScores: { 1: 9000, 2: 5000, 3: 2600 },
    coins: 320, lives: 3, winStreak: 2,
    stats: { lifetimeWins: 3, lifetimeMatches: 140, bestWinStreak: 2 },
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
  assert.equal(sanitizeSave({ lives: "abc" }).lives, LIVES_MAX);
  assert.equal(sanitizeSave(fromJson('{"lives":1e400}')).lives, LIVES_MAX);

  const s = sanitizeSave({ stats: { lifetimeWins: "7", lifetimeMatches: -4, bestCascadeLevel: null } });
  assert.equal(s.stats.lifetimeWins, 7);
  assert.equal(s.stats.lifetimeMatches, 0);
  assert.equal(s.stats.bestCascadeLevel, 0);
  for (const [k, v] of Object.entries(s.stats)) {
    assert.equal(Number.isFinite(v), true, `stats.${k} sonlu sayi olmali`);
  }

  assert.equal(sanitizeSave({ inventory: { shuffle: "3", hammer: -1 } }).inventory.shuffle, 3);
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
    dailyQuests: [gecerliGorev({ id: "a" }), gecerliGorev({ id: "b" }), gecerliGorev({ id: "c" })],
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
  assert.equal(settleLives({ lives: "abc", lastLifeRegenMs: now }, now).lives, LIVES_MAX);
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
    stars: { 1: 3, 2: 2 }, highScores: { 1: 9000, 2: 5000 }, maxLevel: 3,
    coins: 412, lives: 2, winStreak: 2,
    inventory: { shuffle: 1 }, achievements: { first_match: true },
    loginDay: 3, lastLoginDateStr: "2026-08-07",
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
