/**
 * DURUM DAYANIKLILIGI — DUZELTME SONRASI DOGRULAMA.
 *
 * `tests/qa_lens2_probe.mjs`'in B2..B8 senaryolarinin BIREBIR tekrari, ama
 * duzeltmeden sonra. Eski probe kasten ELLENMEDI (kanit); zaten B2'de
 * `assert.equal(unlocked.length, LEVELS.length)` ile hatayi SABITLEDIGI icin
 * artik AssertionError ile duruyor -- bu da bulgunun kalktiginin kanitidir.
 *
 * Kosum:
 *   node --import ./tests/qa_hooks.mjs qa/durum_dogrulama.mjs
 */
import assert from 'node:assert/strict';
import { __seed, __clear } from '../tests/qa_asyncstorage_stub.mjs';
import {
  loadProgress, localDateStr, daysBetween, evaluateDailyLogin, needsQuestRefresh,
} from '../src/utils/storage.js';
import { ensureDailyQuests, applyQuestEvents } from '../src/utils/quests.js';
import { settleLives, msUntilNextLife, formatMsClock, takeLife } from '../src/utils/lives.js';
import * as economy from '../src/constants/economy.js';
import { LEVELS } from '../src/constants/levels.js';

const KEY = 'sugarblast_progress';
const load = async (raw) => { __clear(); __seed(KEY, raw); return loadProgress(); };
const satir = (etiket, m) => console.log(`${etiket.padEnd(6)} ${m}`);
let hepsiIyi = true;
const bekle = (kosul, m) => { if (!kosul) { hepsiIyi = false; satir('!!!', m); } };

console.log('=== B2) Kayittaki maxLevel dogrulaniyor mu? ===');
{
  const s = await load('{"maxLevel":999}');
  const acik = LEVELS.map((_, i) => i + 1).filter((n) => n <= (s?.maxLevel || 1));
  satir('SIMDI', `maxLevel:999 -> ${s.maxLevel} | acik seviye ${acik.length}/${LEVELS.length} (ONCE: 30/30)`);
  bekle(acik.length === 1, 'maxLevel hala kayittan aciyor');
}
for (const [ad, raw] of [['1e400', '{"maxLevel":1e400}'], ['-5', '{"maxLevel":-5}'], ['"30"', '{"maxLevel":"30"}']]) {
  const s = await load(raw);
  satir('SIMDI', `maxLevel:${ad} -> ${s.maxLevel}`);
  bekle(s.maxLevel === 1, `maxLevel:${ad} elenmedi`);
}
{
  const s = await load('{"maxLevel":1,"stars":{"1":3,"2":1},"highScores":{"1":9000,"2":3000}}');
  satir('SIMDI', `2 seviye kazanilmis (yildizli) -> TURETILEN maxLevel ${s.maxLevel} (mesru ilerleme korunuyor)`);
  bekle(s.maxLevel === 3, 'mesru ilerleme kayboldu');
}

console.log('\n=== B3) Bozuk dailyQuests + bugunun tarihi ===');
{
  const today = localDateStr();
  const s = await load(JSON.stringify({ dailyQuests: [1, 2, 3], lastQuestRefreshDateStr: today }));
  satir('SIMDI', `yuklemede elendi -> dailyQuests=${JSON.stringify(s.dailyQuests)} tarih='${s.lastQuestRefreshDateStr}'`);
  const after = ensureDailyQuests(s);
  satir('SIMDI', `ensureDailyQuests YENILEDI -> ${after.dailyQuests.length} gorev, hepsi progress=0`);
  bekle(after.dailyQuests.length === 3, 'gorevler yenilenmedi');
  // QuestRow govdesinin normalize edilmis hali (bkz. DailyQuestsModal.normalizeQuest)
  const q = after.dailyQuests[0];
  satir('SIMDI', `QuestRow render: ${q.progress.toLocaleString()} / ${q.target.toLocaleString()} (ONCE: TypeError)`);
}
{
  const today = localDateStr();
  const eski = [1, 2, 3].map((i) => ({ id: 'q' + i, event: 'win', target: 3, reward: 50, desc: 'Win 3 levels' }));
  const s = await load(JSON.stringify({ dailyQuests: eski, lastQuestRefreshDateStr: today }));
  const after = ensureDailyQuests(s);
  const { quests: q2, earnedCoins } = applyQuestEvents(after, [{ type: 'win', value: 1 }]);
  satir('SIMDI', `eski-surum (progress'siz) gorev -> yenilendi, progress=${q2[0].progress} claimed=${q2[0].claimed} coin=${earnedCoins}`);
  bekle(Number.isFinite(q2[0].progress), 'progress hala NaN');
}

console.log('\n=== B4) coins tipi/isareti dogrulaniyor mu? ===');
{
  const s = await load('{"coins":"50"}');
  const odul = economy.DAILY_LOGIN_REWARDS.find((r) => r.day === 1).coins;
  const sonra = s.coins + odul;
  const def = economy.BOOSTER_DEFS.plus5;
  satir('SIMDI', `coins="50" -> ${JSON.stringify(s.coins)} (${typeof s.coins}); +${odul} = ${JSON.stringify(sonra)} (ONCE: "5025")`);
  satir('SIMDI', `satin alma sonrasi = ${sonra - def.cost} (ONCE: 4975)`);
  bekle(sonra === 75, 'metin coins hala birlestiriyor');
}
// 1e400 -> JSON.parse Infinity; sonlu olmadigi icin varsayilana duser (sisirme YOK).
for (const [ad, raw, bekleDeger] of [
  ['-999', '{"coins":-999}', 0],
  ['1e400', '{"coins":1e400}', economy.STARTER_COINS],
  ['"abc"', '{"coins":"abc"}', economy.STARTER_COINS],
]) {
  const s = await load(raw);
  satir('SIMDI', `coins:${ad} -> ${s.coins} (sonlu: ${Number.isFinite(s.coins)})`);
  bekle(s.coins === bekleDeger, `coins:${ad} beklenen ${bekleDeger}, gelen ${s.coins}`);
}

console.log('\n=== B5) Gunluk giris: cihaz saati oynatilinca ===');
{
  // App.js'in YENI karar yolu: evaluateDailyLogin + monoton claim.
  let save = { loginDay: 0, lastLoginDateStr: '', coins: 0 };
  const dizi = ['2026-08-07', '2026-08-06', '2026-08-07', '2026-08-06', '2026-08-07'];
  for (const d of dizi) {
    const kr = evaluateDailyLogin(save, d);
    if (!kr.showModal) { satir('SIMDI', `${d}: odul YOK (daysSince=${kr.daysSince})`); continue; }
    const coins = economy.DAILY_LOGIN_REWARDS.find((r) => r.day === kr.nextDay).coins;
    const claimedOn = save.lastLoginDateStr > d ? save.lastLoginDateStr : d;
    save = { ...save, coins: save.coins + coins, loginDay: kr.nextDay, lastLoginDateStr: claimedOn };
    satir('SIMDI', `${d}: gun ${kr.nextDay} odulu ALINDI (+${coins}), toplam ${save.coins}`);
  }
  satir('SIMDI', `5 acilis toplami: ${save.coins} coin (ONCE: 175)`);
  bekle(save.coins === 25, `beklenen 25 coin, gelen ${save.coins}`);
}
{
  // Mesru streak bozulmadi mi?
  const a = evaluateDailyLogin({ lastLoginDateStr: '2026-08-06', loginDay: 3 }, '2026-08-07');
  const b = evaluateDailyLogin({ lastLoginDateStr: '2026-08-01', loginDay: 3 }, '2026-08-07');
  satir('SIMDI', `ardisik gun -> gun ${a.nextDay} (4 olmali) | seri kirik -> gun ${b.nextDay} (1 olmali)`);
  bekle(a.nextDay === 4 && b.nextDay === 1, 'mesru streak mantigi bozuldu');
}

console.log('\n=== B4b) Gece yarisi devri ===');
{
  const dun = {
    lastQuestRefreshDateStr: '2026-08-06',
    dailyQuests: [1, 2, 3].map((i) => ({
      id: 'q' + i, event: 'win', desc: 'Win 3 levels',
      target: 3, progress: 3, reward: 50, claimed: true,
    })),
  };
  satir('SIMDI', `dunun gorevleri bugun gecerli mi: ${!needsQuestRefresh(dun, '2026-08-07')} (false olmali)`);
  bekle(needsQuestRefresh(dun, '2026-08-07') === true, 'gun donusu yakalanmiyor');
  const app = (await import('node:fs')).readFileSync(
    new URL('../App.js', import.meta.url), 'utf8');
  const appState = /AppState\.addEventListener\(\s*'change'/.test(app);
  const devirDeps = /\}, \[dayStr, save\]\)/.test(app);
  satir('SIMDI', `App.js AppState dinleyicisi: ${appState} (ONCE: depoda AppState HIC YOKTU)`);
  satir('SIMDI', `devir efekti gun degisimine bagli: ${devirDeps} (ONCE: deps \`[]\`)`);
  bekle(appState && devirDeps, 'App.js devir baglantisi eksik');
}

console.log('\n=== B8) Cihaz saati GERI alinirsa can rejenerasyonu ===');
{
  const now = Date.now();
  const gelecek = now + 30 * 24 * 60 * 60 * 1000;
  const s = { lives: 0, lastLifeRegenMs: gelecek };
  const a = settleLives(s, now);
  satir('SIMDI', `anchor 30 gun ileride -> settleLives lives=${a.lives}, anchor DEGISTI mi: ${a.lastLifeRegenMs !== gelecek} (ONCE: false)`);
  satir('SIMDI', `geri sayim: ${formatMsClock(msUntilNextLife(s, now))} (ONCE: 43220:00)`);
  const sonra = settleLives({ ...s, ...a }, now + economy.LIFE_REGEN_MS);
  satir('SIMDI', `20 dk sonra lives=${sonra.lives}, takeLife: ${takeLife({ ...s, ...a }, now + economy.LIFE_REGEN_MS) ? 'CALISTI' : 'null'} (ONCE: 30 gun kilitli)`);
  bekle(a.lastLifeRegenMs <= now, 'anchor kirpilmadi');
  bekle(formatMsClock(msUntilNextLife(s, now)) === '20:00', 'geri sayim hala 20:00 uzeri');
  bekle(sonra.lives === 1, 'can gelmedi');
}

// Yuklemede de kirpiliyor mu?
{
  const s = await load(JSON.stringify({ lives: 0, lastLifeRegenMs: Date.now() + 9e11 }));
  satir('SIMDI', `yuklemede anchor <= now: ${s.lastLifeRegenMs <= Date.now()}`);
  bekle(s.lastLifeRegenMs <= Date.now(), 'yuklemede anchor kirpilmiyor');
}

console.log(`\n=== SONUC: ${hepsiIyi ? 'TUM DURUM BULGULARI KAPALI' : 'EN AZ BIRI ACIK'}`);
assert.equal(hepsiIyi, true);
process.exit(hepsiIyi ? 0 : 1);
