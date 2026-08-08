/**
 * BAGIMSIZ DOGRULAMA — A) KAYIT ISTISMARI SIFIRDAN
 *
 * Soru 1 (ISTISMAR): kaydin HANGI alanini elle yazarsam kilitli seviye acilir?
 *   -> TUM ust duzey alanlar tek tek + ikili kombinasyonlar denenir.
 * Soru 2 (TERS YON): MESRU ilerleme kayboluyor mu?
 *   -> 1..5 kazanilmis, 1..30 kazanilmis, kaydet->yukle turu.
 *
 * Hicbir kaynak dosya degistirilmez. Sadece OLCUM.
 */
import "../tests/qa_hooks.mjs";

const S = await import("../src/utils/storage.js");
const { LEVELS } = await import("../src/constants/levels.js");
const { __clear, __seed, __raw } = await import("../tests/qa_asyncstorage_stub.mjs");

const N = LEVELS.length;
let kirik = 0, saglam = 0;
const rapor = [];

function ac(baslik, kosul, detay) {
  if (kosul) { saglam++; rapor.push(`  [SAGLAM] ${baslik} ${detay ?? ""}`); }
  else { kirik++; rapor.push(`  [KIRIK ] ${baslik} ${detay ?? ""}`); }
}

console.log(`LEVELS.length = ${N}`);
console.log(`LEVELS[0] = ${JSON.stringify(LEVELS[0])}`);
console.log(`LEVELS[29] = ${JSON.stringify(LEVELS[29])}`);
console.log("");

// ---------------------------------------------------------------------------
// 1) TEK ALAN TARAMASI — her ust duzey alana "sisirilmis" bir deger yaz,
//    maxLevel'e ne oldugunu olc.
// ---------------------------------------------------------------------------
console.log("=== 1) TEK ALAN TARAMASI (her alan tek basina) ===");
const doluHarita = {};       // 1..30 -> 3
const doluSkor = {};         // 1..30 -> 1 puan
const doluSkorBuyuk = {};    // 1..30 -> 1e9
for (let i = 1; i <= N; i++) { doluHarita[i] = 3; doluSkor[i] = 1; doluSkorBuyuk[i] = 1e9; }

const adaylar = {
  maxLevel: 999,
  stars: doluHarita,
  highScores: doluSkor,
  coins: 1e9,
  lives: 99,
  lastLifeRegenMs: 0,
  inventory: { hammer: 9999, shuffle: 9999 },
  loginDay: 7,
  lastLoginDateStr: "2099-12-31",
  dailyQuests: [],
  lastQuestRefreshDateStr: "2099-12-31",
  winStreak: 999,
  stats: {
    lifetimeMatches: 1e9, lifetimeCascadesBig: 1e9, lifetimeSpecialsMade: 1e9,
    lifetimeColorBombs: 1e9, lifetimeCoinsEarned: 1e9, lifetimeWins: 1e9,
    bestCascadeLevel: 1e9, bestWinStreak: 1e9,
  },
  achievements: {},
};

for (const [alan, deger] of Object.entries(adaylar)) {
  const r = S.sanitizeSave({ [alan]: deger });
  const bayrak = r.maxLevel > 1 ? "  <-- SEVIYE ACILDI" : "";
  console.log(`  ${alan.padEnd(24)} -> maxLevel=${String(r.maxLevel).padEnd(3)} coins=${String(r.coins).padEnd(11)}${bayrak}`);
}

// ---------------------------------------------------------------------------
// 2) IKILI KOMBINASYONLAR — asil soru: yazili YILDIZ hala kanit sayiliyor mu?
// ---------------------------------------------------------------------------
console.log("\n=== 2) IKILI KOMBINASYON: stars + highScores ===");

const senaryolar = [
  ["stars 1..30=3 (tek basina)", { stars: doluHarita }],
  ["highScores 1..30=1 (tek basina)", { highScores: doluSkor }],
  ["stars 1..30=3 + highScores 1..30=1 PUAN", { stars: doluHarita, highScores: doluSkor }],
  ["stars 1..30=1 + highScores 1..30=1 PUAN", (() => { const s = {}; for (let i = 1; i <= N; i++) s[i] = 1; return { stars: s, highScores: doluSkor }; })()],
  ["highScores 1..30=1e9 (buyuk skor)", { highScores: doluSkorBuyuk }],
  ["stars 30=3 + highScores 30=1 (tek seviye)", { stars: { 30: 3 }, highScores: { 30: 1 } }],
  ["maxLevel=999 + stars/highScores yok", { maxLevel: 999 }],
];

for (const [ad, kayit] of senaryolar) {
  const r = S.sanitizeSave(kayit);
  const yildizToplam = Object.values(r.stars).reduce((a, b) => a + b, 0);
  console.log(`  ${ad.padEnd(44)} -> maxLevel=${String(r.maxLevel).padEnd(3)} acik=${r.maxLevel}/${N} turetilmisYildiz=${yildizToplam}`);
}

const istismar = S.sanitizeSave({ stars: doluHarita, highScores: doluSkor });
ac("stars+highScores(1 puan) ile sicratma", istismar.maxLevel === 1,
   `-> maxLevel=${istismar.maxLevel} (beklenen 1)`);

// ---------------------------------------------------------------------------
// 3) TERS YON — MESRU ILERLEME KORUNUYOR MU?
// ---------------------------------------------------------------------------
console.log("\n=== 3) TERS YON: MESRU ILERLEME ===");

// (a) 1..5 sirayla kazanilmis (target1 esiginde, App.js'in yazacagi bicim)
function mesruKayit(sonSeviye, carpan = 1) {
  const stars = {}, highScores = {};
  for (let i = 1; i <= sonSeviye; i++) {
    const lv = LEVELS[i - 1];
    const skor = Math.round(lv.target1 * carpan);
    highScores[i] = skor;
    const y = S.computeStars(skor, lv);
    if (y > 0) stars[i] = y;
  }
  return { stars, highScores };
}

for (const [ad, son, carpan] of [["1..5 target1", 5, 1], ["1..5 target3", 5, 1.6], ["1..30 target1", 30, 1], ["1..30 target3", 30, 1.6]]) {
  const kayit = mesruKayit(son, carpan);
  const r = S.sanitizeSave(kayit);
  const beklenen = Math.min(N, son + 1);
  const korunanSkor = Object.keys(r.highScores).length;
  ac(`MESRU ${ad}`, r.maxLevel === beklenen && korunanSkor === son,
     `-> maxLevel=${r.maxLevel} (beklenen ${beklenen}), korunan skor kaydi=${korunanSkor}/${son}`);
}

// (b) target1'in ALTINDA kazanilmis olamaz -> ama ESKI kalibrasyon senaryosu:
//     skor dusuk, yildiz yazili. Bu MESRU mu ISTISMAR mi? Ikisi de ayni sekil!
{
  const stars = {}, highScores = {};
  for (let i = 1; i <= 5; i++) { stars[i] = 1; highScores[i] = 1; }
  const r = S.sanitizeSave({ stars, highScores });
  console.log(`  [BILGI ] "eski kalibrasyon" bicimi (5 seviye, 1 puan + 1 yildiz) -> maxLevel=${r.maxLevel}`);
  console.log(`           ^ bu bicim ISTISMARLA AYNI: ayirt edilemiyor.`);
}

// (c) kaydet -> yukle turu (gercek JSON serilestirme yolu)
console.log("\n=== 4) KAYDET -> YUKLE TURU ===");
__clear();
const oncesi = S.sanitizeSave(mesruKayit(7, 1.2));
await S.saveProgress(oncesi);
const sonrasi = await S.loadProgress();
ac("kaydet->yukle: maxLevel korunuyor",
   sonrasi.maxLevel === oncesi.maxLevel,
   `-> once=${oncesi.maxLevel} sonra=${sonrasi.maxLevel}`);
ac("kaydet->yukle: yildizlar korunuyor",
   JSON.stringify(sonrasi.stars) === JSON.stringify(oncesi.stars),
   `-> ${JSON.stringify(oncesi.stars)} vs ${JSON.stringify(sonrasi.stars)}`);
ac("kaydet->yukle: skorlar korunuyor",
   JSON.stringify(sonrasi.highScores) === JSON.stringify(oncesi.highScores));

// (d) IKI TUR (idempotent mi? her yuklemede biraz daha kirpiliyor mu?)
await S.saveProgress(sonrasi);
const ucuncu = await S.loadProgress();
ac("cift tur idempotent (her yuklemede kirpilmiyor)",
   ucuncu.maxLevel === sonrasi.maxLevel && JSON.stringify(ucuncu.stars) === JSON.stringify(sonrasi.stars),
   `-> ${sonrasi.maxLevel} -> ${ucuncu.maxLevel}`);

// (e) coin/booster/achievement ters yonu: mesru oyuncu parasini kaybediyor mu?
console.log("\n=== 5) TERS YON: CUZDAN / ENVANTER / BASARIM ===");
{
  const mesru = {
    ...mesruKayit(10, 1.3),
    coins: 400,
    stats: { lifetimeMatches: 900, lifetimeCascadesBig: 20, lifetimeSpecialsMade: 60,
             lifetimeColorBombs: 5, lifetimeCoinsEarned: 800, lifetimeWins: 10,
             bestCascadeLevel: 6, bestWinStreak: 6 },
    winStreak: 3,
    inventory: { hammer: 2 },
  };
  const r = S.sanitizeSave(mesru);
  ac("mesru coins korunuyor", r.coins === 400, `-> ${r.coins} (yazilan 400)`);
  ac("mesru winStreak korunuyor", r.winStreak === 3, `-> ${r.winStreak}`);
  ac("mesru envanter korunuyor", r.inventory.hammer === 2, `-> ${JSON.stringify(r.inventory)}`);
  ac("mesru stats korunuyor", r.stats.lifetimeMatches === 900 && r.stats.lifetimeWins === 10,
     `-> ${JSON.stringify(r.stats)}`);
}

// ---------------------------------------------------------------------------
console.log("\n" + rapor.join("\n"));
console.log(`\nTOPLAM: SAGLAM=${saglam}  KIRIK=${kirik}`);
