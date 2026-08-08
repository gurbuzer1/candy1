/**
 * BAGIMSIZ DOGRULAMA — A2) "SISIRILMIS STATS + achievements:false = BEDAVA COIN"
 * iddiasi. Tek alan degil, ALAN CIFTLERI denenir (gecen tur istismar tam da
 * boyle "bir alan oteye" tasinmisti).
 */
import "../tests/qa_hooks.mjs";

const S = await import("../src/utils/storage.js");
const A = await import("../src/utils/achievements.js");
const { STARTER_COINS } = await import("../src/constants/economy.js");

console.log(`STARTER_COINS = ${STARTER_COINS}`);
console.log(`ACHIEVEMENTS sayisi = ${A.ACHIEVEMENTS?.length ?? "?"}\n`);

const buyukStats = {
  lifetimeMatches: 1e9, lifetimeCascadesBig: 1e9, lifetimeSpecialsMade: 1e9,
  lifetimeColorBombs: 1e9, lifetimeCoinsEarned: 1e9, lifetimeWins: 1e9,
  bestCascadeLevel: 1e9, bestWinStreak: 1e9,
};

const testler = [
  ["coins:1e9 (tek basina)", { coins: 1e9 }],
  ["stats sisik (tek basina)", { stats: buyukStats }],
  ["coins:1e9 + stats sisik", { coins: 1e9, stats: buyukStats }],
  ["coins:1e9 + sadece lifetimeCoinsEarned:1e9", { coins: 1e9, stats: { lifetimeCoinsEarned: 1e9 } }],
  ["inventory 9999 + stats sisik", { inventory: { hammer: 9999, shuffle: 9999, bomb: 9999 }, stats: buyukStats }],
];

for (const [ad, kayit] of testler) {
  const r = S.sanitizeSave(kayit);
  const ach = Object.keys(r.achievements).length;
  console.log(`  ${ad.padEnd(46)} -> coins=${String(r.coins).padEnd(12)} basarim=${ach} envanter=${JSON.stringify(r.inventory)}`);
}

// achievements:false ile SONSUZ ODEME dongusu hala var mi?
console.log("\n=== achievements bayragi FALSE + kosul saglaniyor ===");
{
  const kayit = { stats: buyukStats, achievements: {} };
  const r = S.sanitizeSave(kayit);
  const acik = Object.keys(r.achievements);
  console.log(`  yuklemede ACILAN basarim sayisi = ${acik.length}`);
  console.log(`  -> ${acik.join(", ")}`);
  const kalan = A.checkUnlocks(r).newlyUnlocked;
  console.log(`  yukleme SONRASI checkUnlocks yeniden ne verir? = ${kalan.length} (0 olmali; degilse App.js her acilista oder)`);
  const odeme = kalan.reduce((a, d) => a + (d.reward ?? 0), 0);
  console.log(`  yeniden odenecek coin = ${odeme}  ${odeme === 0 ? "[SAGLAM]" : "[KIRIK]"}`);
}
