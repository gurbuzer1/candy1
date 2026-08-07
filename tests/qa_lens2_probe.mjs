/**
 * LENS 2 KANIT PROBU — "kaydedilmis ilerleme guvenilmez girdidir".
 *
 * Bu dosya URUNU DEGISTIRMEZ. Sadece gercek `src/utils/storage.js`,
 * `src/utils/quests.js`, `src/utils/lives.js` modullerini duz node ile
 * import edip bozuk/elle degistirilmis kayitlarla besler.
 *
 * `npm test` bunu KOSMAZ (glob `tests/*.test.js`, bu dosya `.mjs`).
 *
 * Kosum:
 *   node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs
 */
import assert from 'node:assert/strict';
import { __seed, __clear } from './qa_asyncstorage_stub.mjs';

const storage = await import('../src/utils/storage.js');
const quests = await import('../src/utils/quests.js');
const economy = await import('../src/constants/economy.js');
const { LEVELS } = await import('../src/constants/levels.js');

const { loadProgress, localDateStr, daysBetween } = storage;
const { ensureDailyQuests, applyQuestEvents } = quests;
const KEY = 'sugarblast_progress';

const results = [];
function say(tag, msg) { results.push(`${tag} ${msg}`); console.log(`${tag} ${msg}`); }

async function load(raw) { __clear(); __seed(KEY, raw); return loadProgress(); }

// ---------------------------------------------------------------- B1: cokme
console.log('\n=== B1) loadProgress bozuk yukle: cokuyor mu? ===');
const payloads = [
  ['null', 'null'],
  ['bos dizi', '[]'],
  ['bos nesne', '{}'],
  ['sayi', '5'],
  ['metin', '"abc"'],
  ['yarim JSON', '{"coins":'],
  ['stats null', '{"stats":null}'],
  ['stats metin', '{"stats":"x"}'],
  ['inventory dizi', '{"inventory":[1,2]}'],
  ['dailyQuests metin', '{"dailyQuests":"abc"}'],
];
for (const [ad, raw] of payloads) {
  try {
    const s = await load(raw);
    say('OK  ', `${ad.padEnd(18)} -> cokmedi, maxLevel=${s.maxLevel} coins=${s.coins}`);
  } catch (e) {
    say('COKTU', `${ad.padEnd(18)} -> ${e.constructor.name}: ${e.message}`);
  }
}

// ------------------------------------------------- B2: KILITLI SEVIYE ACILIR
console.log('\n=== B2) Kayittaki maxLevel dogrulaniyor mu? ===');
{
  const s = await load('{"maxLevel":999}');
  const unlocked = LEVELS.map((_, i) => i + 1).filter((n) => n <= (s?.maxLevel || 1));
  const yildizli = Object.keys(s.stars).length;
  say('BULGU', `maxLevel=${s.maxLevel} (kayittan aynen alindi, dogrulama yok)`);
  say('BULGU', `LevelSelectScreen kuraliyla acik seviye = ${unlocked.length}/${LEVELS.length}`);
  say('BULGU', `oysa kazanilmis yildizli seviye sayisi = ${yildizli} (TURETILSE 1 olmaliydi)`);
  assert.equal(unlocked.length, LEVELS.length);
}
{
  const s = await load('{"maxLevel":1e400}');
  say('BULGU', `maxLevel:1e400 -> JSON.parse => ${s.maxLevel} (Infinity), tum seviyeler acik`);
}
{
  const s = await load('{"maxLevel":-5}');
  const unlocked = LEVELS.map((_, i) => i + 1).filter((n) => n <= (s?.maxLevel || 1));
  say('BULGU', `maxLevel=-5 -> acik seviye = ${unlocked.length} (OYUN OYNANAMAZ, sifirlama yolu yok)`);
}

// --------------------------------------------- B3: gorev satiri kayittan gelir
console.log('\n=== B3) Bozuk dailyQuests + bugunun tarihi ===');
{
  const today = localDateStr();
  const s = await load(JSON.stringify({ dailyQuests: [1, 2, 3], lastQuestRefreshDateStr: today }));
  const after = ensureDailyQuests(s);
  say('BULGU', `ensureDailyQuests bunu YENILEMEDI: ${JSON.stringify(after.dailyQuests)}`);
  // DailyQuestsModal -> QuestRow govdesi birebir:
  try {
    const q = after.dailyQuests[0];
    const pct = Math.min(100, (q.progress / q.target) * 100);
    const txt = `${q.progress.toLocaleString()} / ${q.target.toLocaleString()}`;
    say('OK  ', `QuestRow render etti: ${txt} pct=${pct}`);
  } catch (e) {
    say('COKTU', `QuestRow govdesi patladi -> ${e.constructor.name}: ${e.message}`);
  }
}
{
  const today = localDateStr();
  // "eski surumden kalan" gorev sekli: progress alani yok
  const eski = [1, 2, 3].map((i) => ({ id: 'q' + i, event: 'win', target: 3, reward: 50, desc: 'Win 3 levels' }));
  const s = await load(JSON.stringify({ dailyQuests: eski, lastQuestRefreshDateStr: today }));
  const after = ensureDailyQuests(s);
  const { quests: q2, earnedCoins } = applyQuestEvents(after, [{ type: 'win', value: 1 }]);
  say('BULGU', `progress alani olmayan gorev -> progress=${q2[0].progress} claimed=${q2[0].claimed} coin=${earnedCoins}`);
  say('BULGU', `gorev SONSUZA KADAR tamamlanamaz (NaN >= 3 hep false)`);
}

// ------------------------------------------------------- B4: cuzdan tipi/isaret
console.log('\n=== B4) coins tipi/isareti dogrulaniyor mu? ===');
{
  const s = await load('{"coins":"50"}');
  const odul = economy.DAILY_LOGIN_REWARDS.find((r) => r.day === 1).coins; // 25
  const sonra = s.coins + odul;            // App.js claimDailyLogin birebir
  const def = economy.BOOSTER_DEFS.plus5;  // cost 50
  const alabilir = !((sonra || 0) < def.cost);
  say('BULGU', `coins="50" (metin) -> gunluk giris sonrasi coins = ${JSON.stringify(sonra)} (tip ${typeof sonra})`);
  say('BULGU', `satin alma kapisi gecti mi: ${alabilir} -> odemeden sonra coins = ${sonra - def.cost}`);
}
{
  const s = await load('{"coins":-999}');
  const def = economy.BOOSTER_DEFS.shuffle;
  say('BULGU', `coins=${s.coins} kayittan aynen alindi; dukkan kilitli (${s.coins} < ${def.cost}) ve kendini onaramaz`);
}
{
  const s = await load('{"coins":1e400}');
  say('BULGU', `coins:1e400 -> ${s.coins} (JSON.parse Infinity uretir); HUD "Infinity" gosterir`);
}

// ---------------------------------------- B5: cihaz saati geri -> odul tekrari
console.log('\n=== B5) Gunluk giris: cihaz saati oynatilinca ===');
{
  // App.js useEffect'teki karar agacini birebir tasiyoruz.
  function bootLoginDecision(save, todayStr) {
    if (save.lastLoginDateStr === todayStr) return null;
    const daysSince = daysBetween(todayStr, save.lastLoginDateStr);
    if (daysSince === 1 && save.loginDay > 0 && save.loginDay < 7) return save.loginDay + 1;
    return 1;
  }
  let save = { loginDay: 0, lastLoginDateStr: '', coins: 0 };
  const dizi = ['2026-08-07', '2026-08-06', '2026-08-07', '2026-08-06', '2026-08-07'];
  for (const d of dizi) {
    const day = bootLoginDecision(save, d);
    if (day == null) { say('OK  ', `${d}: odul yok (ayni gun)`); continue; }
    const coins = economy.DAILY_LOGIN_REWARDS.find((r) => r.day === day).coins;
    save = { ...save, coins: save.coins + coins, loginDay: day, lastLoginDateStr: d };
    say('BULGU', `cihaz tarihi ${d} -> gun ${day} odulu ALINDI (+${coins}), toplam ${save.coins}`);
  }
  say('BULGU', `saat ileri/geri 5 acilista toplam ${save.coins} coin; tekrar sayaci/monoton saat kontrolu YOK`);
}

// ---------------------------------------- B6: ayni basarim iki kez odul verir mi
console.log('\n=== B6) Basarim iki kez odul veriyor mu? ===');
{
  const { checkUnlocks } = await import('../src/utils/achievements.js');
  let save = { stats: { lifetimeMatches: 5, lifetimeCoinsEarned: 0, bestWinStreak: 0 }, achievements: {}, maxLevel: 1, stars: {} };
  const a = checkUnlocks(save);
  for (const d of a.newlyUnlocked) save.achievements[d.id] = true;
  const b = checkUnlocks(save);
  say('OK  ', `1. cagri: ${a.newlyUnlocked.map((x) => x.id)} (+${a.rewardCoins}) / 2. cagri: ${b.newlyUnlocked.map((x) => x.id)} (+${b.rewardCoins})`);
  assert.equal(b.rewardCoins, 0);
  // ama bayrak elle false yapilirsa?
  save.achievements.first_match = false;
  const c = checkUnlocks(save);
  say(c.rewardCoins > 0 ? 'BULGU' : 'OK  ', `achievements.first_match=false elle yazilinca tekrar odul: +${c.rewardCoins}`);
}

// ------------------------------- B7: "Next Level" can kapisini atlar mi (TAMPER YOK)
console.log('\n=== B7) 0 can ile "Next Level" — elle kayit degistirmeden ===');
{
  const { takeLife } = await import('../src/utils/lives.js');
  // App.js handleConfirmBoosters govdesi birebir (booster secimi bos):
  function confirmBoosters(prev) {
    const next = { ...prev, inventory: { ...prev.inventory } };
    const lifeUpd = takeLife(next);
    if (lifeUpd) { next.lives = lifeUpd.lives; next.lastLifeRegenMs = lifeUpd.lastLifeRegenMs; }
    return { next, oyunBasladi: true }; // setScreen('game') KOSULSUZ cagriliyor
  }
  let save = { lives: 1, lastLifeRegenMs: Date.now(), inventory: {} };
  let r = confirmBoosters(save); save = r.next;
  say('OK  ', `1. seviye: can 1 -> ${save.lives}, oyun basladi=${r.oyunBasladi}`);
  for (let i = 2; i <= 5; i++) {
    // handleNextLevel() can KONTROLU YAPMAZ -> dogrudan pendingLevelNum
    r = confirmBoosters(save); save = r.next;
    say('BULGU', `${i}. seviye "Next Level" ile: can ${save.lives}, oyun basladi=${r.oyunBasladi} (takeLife null dondu, oyun yine acildi)`);
  }
  say('BULGU', `handleReplayLevel can kontrolu YAPAR, handleNextLevel YAPMAZ -> kazandigin surece can sistemi devre disi`);
}

// ------------------------------- B8: saat geri alinirsa can rejenerasyonu kilitlenir
console.log('\n=== B8) Cihaz saati GERI alinirsa can rejenerasyonu ===');
{
  const { settleLives, msUntilNextLife, formatMsClock } = await import('../src/utils/lives.js');
  const now = Date.now();
  const gelecek = now + 30 * 24 * 60 * 60 * 1000; // saat 30 gun ileriyken oynanmis
  const s = { lives: 0, lastLifeRegenMs: gelecek };
  const a = settleLives(s, now);
  say('BULGU', `lastLifeRegenMs 30 gun ilerideyken settleLives -> lives=${a.lives}, anchor DEGISMEDI (${a.lastLifeRegenMs === gelecek})`);
  say('BULGU', `geri sayim ekrani: ${formatMsClock(msUntilNextLife(s, now))} (dk:sn) — 30 gun boyunca can gelmez, kendini onarmaz`);
}

console.log('\n=== OZET ===');
for (const r of results.filter((r) => r.startsWith('COKTU') || r.startsWith('BULGU'))) console.log(r);
