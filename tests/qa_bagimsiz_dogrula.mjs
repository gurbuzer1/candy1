/**
 * BAGIMSIZ DOGRULAMA — verilen probu KOPYALAMAZ.
 * QuestRow govdesini elle yeniden yazmak yerine GERCEK dosyadan cikarip
 * calistiriyorum, boylece "birebir mi" sorusu ortadan kalkiyor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { __seed, __clear } from './qa_asyncstorage_stub.mjs';

const ROOT = 'C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1';
const { loadProgress, localDateStr } = await import('../src/utils/storage.js');
const { ensureDailyQuests, applyQuestEvents } = await import('../src/utils/quests.js');
const { QUEST_POOL } = await import('../src/constants/economy.js');
const KEY = 'sugarblast_progress';

console.log('QUEST_POOL uzunlugu =', QUEST_POOL.length, '(3ten kucukse ensureDailyQuests hep yeniler)');

// --- GERCEK dosyadan QuestRow'un iki hesap satirini CIKAR ---
const src = fs.readFileSync(path.join(ROOT, 'src/components/DailyQuestsModal.js'), 'utf8');
const pctLine = src.match(/const pct = (.+);/)[1];
const txtLine = src.match(/\{(q\.progress\.toLocaleString\(\))\} \/ \{(q\.target\.toLocaleString\(\))\}/);
console.log('DailyQuestsModal.js icinden CIKARILAN ifadeler:');
console.log('   pct  =', pctLine);
console.log('   metin=', txtLine[1], '+', txtLine[2]);
const questRowBody = new Function('q', `const pct = ${pctLine}; return \`\${${txtLine[1]}} / \${${txtLine[2]}}\` + " pct=" + pct;`);

async function load(raw) { __clear(); __seed(KEY, raw); return loadProgress(); }

const today = localDateStr();

const vakalar = [
  ['sayi dizisi        ', JSON.stringify({ dailyQuests: [1, 2, 3], lastQuestRefreshDateStr: today })],
  ['bos nesne x3       ', JSON.stringify({ dailyQuests: [{}, {}, {}], lastQuestRefreshDateStr: today })],
  ['null x3            ', JSON.stringify({ dailyQuests: [null, null, null], lastQuestRefreshDateStr: today })],
  ['progress alani yok ', JSON.stringify({ dailyQuests: [1, 2, 3].map((i) => ({ id: 'q' + i, event: 'win', target: 3, reward: 50, desc: 'd' })), lastQuestRefreshDateStr: today })],
  ['uzunluk 2 (kontrol)', JSON.stringify({ dailyQuests: [1, 2], lastQuestRefreshDateStr: today })],
  ['dun tarihli (kontrol)', JSON.stringify({ dailyQuests: [1, 2, 3], lastQuestRefreshDateStr: '2020-01-01' })],
];

for (const [ad, raw] of vakalar) {
  const s = await load(raw);
  const after = ensureDailyQuests(s);
  const yenilendi = after.dailyQuests !== s.dailyQuests;
  let sonuc;
  try { sonuc = 'RENDER OK -> ' + questRowBody(after.dailyQuests[0]); }
  catch (e) { sonuc = 'COKTU -> ' + e.constructor.name + ': ' + e.message; }
  console.log(`${ad} | yenilendi=${String(yenilendi).padEnd(5)} | ${sonuc}`);
}

// --- ilerleme kilitleniyor mu? ---
{
  const eski = [1, 2, 3].map((i) => ({ id: 'q' + i, event: 'win', target: 3, reward: 50, desc: 'd' }));
  let s = await load(JSON.stringify({ dailyQuests: eski, lastQuestRefreshDateStr: today }));
  s = ensureDailyQuests(s);
  for (let i = 0; i < 10; i++) {
    const r = applyQuestEvents(s, [{ type: 'win', value: 1 }]);
    s = { ...s, dailyQuests: r.quests };
  }
  console.log('10 galibiyet sonrasi progress =', s.dailyQuests[0].progress, 'claimed =', s.dailyQuests[0].claimed);
}
