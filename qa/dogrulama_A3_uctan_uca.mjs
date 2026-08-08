/**
 * BAGIMSIZ DOGRULAMA — A3) ISTISMAR EKRANA KADAR ULASIYOR MU?
 *
 * sanitizeSave'in maxLevel=30 dondurmesi tek basina "seviye acildi" demek
 * degil. Burada GERCEK LevelSelectScreen mount edilir ve kilit gostergesi
 * ('🔒' vs seviye numarasi) agactan OKUNUR.
 *
 * ⚠️ OLCUM NOTU (kalibrasyon): App.js'i mount edip AsyncStorage'a kayit
 * TOHUMLAMAK bu kosum takimiyla MUMKUN DEGIL — qa_akis_render.mjs paket
 * import'larini (async-storage dahil) host-bilesen Proxy'sine cevirir, yani
 * `getItem` bir eleman doner, `JSON.parse` patlar ve loadProgress DAIMA
 * DEFAULT_SAVE verir. Bu yuzden kayit `sanitizeSave`ten gecirilip DOGRUDAN
 * ekrana prop olarak verilir (App.js'in yaptigi da tam olarak budur).
 */
import "../tests/qa_hooks.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { mount, flattenNodes, collectText } = await import("../tests/qa_akis_render.mjs");
const S = await import("../src/utils/storage.js");
const { LEVELS } = await import("../src/constants/levels.js");

const LS = path.join(KOK, "src", "screens", "LevelSelectScreen.js");

// ELLE YAZILMIS KAYIT: her seviyede 1 PUAN + 1 YILDIZ.
const stars = {}, highScores = {};
for (let i = 1; i <= LEVELS.length; i++) { stars[i] = 1; highScores[i] = 1; }
const SAHTE = {
  maxLevel: 1, stars, highScores,
  coins: 999999999,
  stats: { lifetimeCoinsEarned: 999999999, lifetimeMatches: 999999, lifetimeWins: 999,
           lifetimeSpecialsMade: 9999, lifetimeColorBombs: 999, lifetimeCascadesBig: 999,
           bestCascadeLevel: 99, bestWinStreak: 99 },
  lives: 5, lastLifeRegenMs: Date.now(),
  inventory: { hammer: 9999, shuffle: 9999 },
  achievements: {},
};

console.log("ELLE YAZILAN KAYIT: her seviyede highScores=1 PUAN + stars=1 YILDIZ");
console.log(`  seviye 30'un gercek target1 = ${LEVELS[29].target1} puan\n`);

function olc(ad, kayit) {
  const save = S.sanitizeSave(kayit);
  const m = mount(LS, { save, onSelectLevel: () => {}, onBack: () => {}, onOpenShop: () => {} });
  const metin = collectText(m.tree);
  const kilitli = metin.filter((t) => t === "🔒").length;
  const acik = LEVELS.length - kilitli;
  console.log(`  ${ad.padEnd(46)} save.maxLevel=${String(save.maxLevel).padEnd(3)} | EKRANDA acik=${acik}/${LEVELS.length} kilitli=${kilitli} | coins=${save.coins} | envanter=${JSON.stringify(save.inventory)}`);
  return { save, acik, kilitli };
}

const a = olc("ELLE YAZILAN sahte kayit", SAHTE);
const b = olc("KONTROL: bos kayit (yeni oyuncu)", {});
const mesru = { stars: {}, highScores: {} };
for (let i = 1; i <= 5; i++) { mesru.stars[i] = 1; mesru.highScores[i] = LEVELS[i - 1].target1; }
const c = olc("KONTROL: MESRU 1..5 kazanilmis", mesru);

console.log("");
console.log(`  SONUC (istismar) : ${a.acik === 1 ? "[SAGLAM] sadece 1 seviye acik" : `[KIRIK] ${a.acik}/30 SEVIYE EKRANDA ACIK — istismar KAPANMAMIS`}`);
console.log(`  SONUC (para)     : ${a.save.coins <= 50 ? "[SAGLAM]" : `[KIRIK] ${a.save.coins} coin`}`);
console.log(`  SONUC (envanter) : ${Object.keys(a.save.inventory).length === 0 ? "[SAGLAM]" : `[KIRIK] ${JSON.stringify(a.save.inventory)}`}`);
console.log(`  KONTROL (yeni)   : ${b.acik === 1 ? "[SAGLAM] 1 acik" : "[?] " + b.acik}`);
console.log(`  KONTROL (mesru)  : ${c.acik === 6 ? "[SAGLAM] 6 acik" : "[KIRIK] " + c.acik} — asiri kirpma YOK`);
