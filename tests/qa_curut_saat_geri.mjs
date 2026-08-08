/**
 * CURUTME PROBU — "cihaz saati geri alinirsa can rejenerasyonu kilitleniyor".
 *
 * Amac: bulguyu CURUTMEK. Bu yuzden HICBIR YERDE elle `lastLifeRegenMs: gelecek`
 * yazmiyorum. Anchor'i sadece GERCEK `takeLife`/`settleLives` cagirarak
 * urettiriyorum, saati oynatarak. Kayit gercek storage.js uzerinden yaziliyor.
 *
 * Kosum:
 *   node --import ./tests/qa_hooks.mjs tests/qa_curut_saat_geri.mjs
 */
import { __clear } from './qa_asyncstorage_stub.mjs';

const { loadProgress, saveProgress } = await import('../src/utils/storage.js');
const { settleLives, takeLife, msUntilNextLife, formatMsClock } =
  await import('../src/utils/lives.js');
const { LIVES_MAX, LIFE_REGEN_MS, BOOSTER_DEFS } = await import('../src/constants/economy.js');

const DK = 60 * 1000;
const SAAT = 60 * DK;
const GUN = 24 * SAAT;

function log(...a) { console.log(...a); }

// --- App.js:48-72 boot govdesi (can kismi birebir) --------------------------
async function boot(now) {
  let s = await loadProgress();          // gercek modul
  const upd = settleLives(s, now);       // App.js:51
  s = { ...s, ...upd };
  await saveProgress(s);                 // App.js:70 — bozuk anchor DISKE yazilir
  return s;
}

// --- App.js:116-139 handleConfirmBoosters can kismi birebir -----------------
function seviyeBasla(save, now) {
  const next = { ...save };
  const lifeUpd = takeLife(next, now);
  if (lifeUpd) { next.lives = lifeUpd.lives; next.lastLifeRegenMs = lifeUpd.lastLifeRegenMs; }
  return next;
}

// --- LevelSelectScreen.js:18-28 kapisi birebir ------------------------------
function levelSelectAcabilirMi(save) {
  const noLives = (save?.lives ?? 5) <= 0;
  return !noLives;
}

// ===========================================================================
// SENARYO 1 — TAMPER YOK, sadece cihaz saati ileri sonra geri.
// ===========================================================================
for (const [ad, kayma] of [
  ['saat 2 saat ileriymis (yanlis kurulum / NTP oncesi)', 2 * SAAT],
  ['oyuncu timer atlamak icin saati 30 gun ileri aldi', 30 * GUN],
  ['oyuncu saati 1 yil ileri aldi', 365 * GUN],
]) {
  console.log(`\n================ SENARYO: ${ad} ================`);
  __clear();
  const T = Date.parse('2026-08-07T12:00:00Z');   // gercek zaman
  const F = T + kayma;                            // cihazin (yanlis) saati

  // 1) Cihaz ileri saatteyken acilis + 5 seviye oynayip 5 cani harca
  let s = await boot(F);
  log(`ileri saatte acilis: lives=${s.lives}`);
  for (let i = 1; i <= LIVES_MAX; i++) {
    s = seviyeBasla(s, F + i * DK);
  }
  await saveProgress(s);
  log(`5 seviye oynandi -> lives=${s.lives}, anchor gercek zamandan ` +
      `${((s.lastLifeRegenMs - T) / DK).toFixed(1)} dk ILERIDE (elle yazilmadi, takeLife uretti)`);

  // 2) Saat GERI duzeltildi (NTP ya da kullanici) — gercek zamana donuldu
  const T2 = T + 6 * SAAT;   // gercek dunyada 6 saat gecti (cok cani hak etti)
  s = await boot(T2);
  const ms = msUntilNextLife(s, T2);
  log(`saat duzeldikten 6 saat SONRA acilis:`);
  log(`   lives            = ${s.lives}   (BEKLENEN: ${LIVES_MAX} — 6 saat > 5x20dk)`);
  log(`   HudBar geri sayim= ${formatMsClock(ms)}   (BEKLENEN: <= 20:00)`);
  log(`   LevelSelect seviye acabiliyor mu = ${levelSelectAcabilirMi(s)}   (BEKLENEN: true)`);

  // 3) Kilit ne kadar surer? gercek zamanda ileri sar.
  let kilitSonu = null;
  for (let d = 0; d <= 400 * 24 * 60; d += 5) {          // 5 dk adimlarla 400 gun
    const n = T + d * DK;
    if (settleLives(s, n).lives > 0) { kilitSonu = d; break; }
  }
  log(`   kilit suresi     = ${kilitSonu == null ? '>400 gun' : (kilitSonu / 60).toFixed(1) + ' saat (' + (kilitSonu / 1440).toFixed(1) + ' gun)'}`);
  log(`   kayma            = ${(kayma / 60000 / 60).toFixed(1)} saat  -> kilit ~= kayma + 20dk`);
}

// ===========================================================================
// SENARYO 2 — CANLAR DOLUYKEN saat geri gelirse KENDINI ONARIYOR MU?
// (bulguyu curutebilecek yol: belki gercek hayatta hep dolu donuluyordur)
// ===========================================================================
console.log('\n================ SENARYO 2: canlar DOLUYKEN saat geri ================');
{
  __clear();
  const T = Date.parse('2026-08-07T12:00:00Z');
  const F = T + 30 * GUN;
  let s = await boot(F);                     // ileri saatte acilis, lives=5
  await saveProgress(s);
  log(`ileri saatte lives=${s.lives}, anchor-T = ${((s.lastLifeRegenMs - T) / GUN).toFixed(1)} gun`);
  s = await boot(T);                         // saat geri
  log(`saat geri gelince: lives=${s.lives}, anchor==now -> ${s.lastLifeRegenMs === T} (KENDINI ONARDI)`);
  log(`=> kilit SADECE lives < ${LIVES_MAX} iken saat geri gelirse olusuyor.`);
}

// ===========================================================================
// SENARYO 3 — kilitliyken KACIS YOLU var mi? (dukkanda can dolumu?)
// LevelSelect pill'i "buy a refill" diyor.
// ===========================================================================
console.log('\n================ SENARYO 3: kacis yolu ================');
{
  const canUrunu = Object.values(BOOSTER_DEFS).filter(
    (d) => /life|heart|refill/i.test(d.id + ' ' + d.name),
  );
  log(`dukkanda can/refill urunu sayisi = ${canUrunu.length} (BOOSTER_DEFS: ${Object.keys(BOOSTER_DEFS).join(', ')})`);
  log(`LevelSelect metni: "Out of lives — wait for regen or buy a refill"`);
}

// ===========================================================================
// SENARYO 4 — formatMsClock sinirsiz dakika alani: normal oyunda gorulur mu?
// ===========================================================================
console.log('\n================ SENARYO 4: geri sayim ust siniri ================');
{
  const T = Date.parse('2026-08-07T12:00:00Z');
  // saat OYNAMADAN mumkun olan en buyuk deger:
  const enBuyuk = msUntilNextLife({ lives: 0, lastLifeRegenMs: T }, T);
  log(`saat oynatilmadan gorulebilecek EN BUYUK geri sayim = ${formatMsClock(enBuyuk)} (LIFE_REGEN_MS=${LIFE_REGEN_MS / DK}dk)`);
  log(`=> "43220:00" ancak anchor gelecekteyken cikar; bagimsiz bir hata degil, SEMPTOM.`);
}
