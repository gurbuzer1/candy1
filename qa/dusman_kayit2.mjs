import { __seed, __clear } from '../tests/qa_asyncstorage_stub.mjs';
import { loadProgress, evaluateDailyLogin, localDateStr, needsQuestRefresh } from '../src/utils/storage.js';
import { LEVELS } from '../src/constants/levels.js';
const KEY='sugarblast_progress';
async function y(j){ __clear(); __seed(KEY,j); return loadProgress(); }

console.log('=== I2) GELECEK tarihli lastLoginDateStr, gercek karar fonksiyonu ===');
const bugun = localDateStr();
console.log('bugun =', bugun);
const s = await y('{"lastLoginDateStr":"2099-12-31","loginDay":7}');
const d = evaluateDailyLogin(s, bugun);
console.log('evaluateDailyLogin ->', JSON.stringify(d));
console.log(d.showModal ? '  [SAGLAM] odul veriliyor' : `  [KIRIK]  gunluk odul KAPALI (daysSince=${d.daysSince}); kayit kendini onarmiyor -> 2099'a kadar gunluk giris YOK`);

console.log('\n=== C7) mesru ilerleme regresyonu (1..5 kazanilmis) ===');
const leg = await y(JSON.stringify({stars:{1:3,2:2,3:1,4:1,5:2}, highScores:{1:22000,2:9000,3:5000,4:6000,5:8000}}));
console.log(`  maxLevel=${leg.maxLevel} (beklenen 6)`, leg.maxLevel===6?'[SAGLAM]':'[KIRIK]');

console.log('\n=== C8) 30. seviye kazanilmis -> tavan ===');
const son = await y(JSON.stringify({stars:{30:1}}));
console.log(`  maxLevel=${son.maxLevel} / LEVELS ${LEVELS.length}`, son.maxLevel===LEVELS.length?'[SAGLAM]':'[KIRIK]');

console.log('\n=== E12) needsQuestRefresh: uydurma id\'li gorev "taze" sayiliyor mu? ===');
const sahte = await y(JSON.stringify({dailyQuests:[
 {id:'a',event:'win',desc:'x',target:1,progress:0,reward:9e8,claimed:false},
 {id:'b',event:'win',desc:'x',target:1,progress:0,reward:9e8,claimed:false},
 {id:'c',event:'win',desc:'x',target:1,progress:0,reward:9e8,claimed:false}], lastQuestRefreshDateStr: bugun}));
console.log('  needsQuestRefresh =', needsQuestRefresh(sahte,bugun), needsQuestRefresh(sahte,bugun)?'[SAGLAM]':'[KIRIK] uydurma liste TAZE sayildi, yenilenmiyor');

console.log('\n=== A12) coins 1e9 tavani: HUD/dukkan davranisi ===');
const c = await y('{"coins":1000000000}');
console.log('  coins =', c.coins, '| 1e9 coin ile satin alinabilecek hammer adedi =', Math.floor(c.coins/100));
