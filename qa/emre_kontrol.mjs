// BAGIMSIZ KONTROL (Emre turu) — dogrulama ajaninin iddiasini KENDI probumla sina.
// Uc soru, ucu de ayri: (1) istismar gercekten acik mi, (2) MESRU oyuncu
// ilerlemesini kaybediyor mu, (3) bozuk kayit cokertiyor mu.
import { sanitizeSave, deriveMaxLevel } from '../src/utils/storage.js';
import { LEVELS } from '../src/constants/levels.js';

const say = (s) => { const m = deriveMaxLevel(s.stars, s.highScores); return m; };

console.log('=== 1) IDDIA: her seviyeye 1 puan + 1 yildiz yazmak 30/30 aciyor mu? ===');
const yogun = { stars: {}, highScores: {} };
for (let n = 1; n <= 30; n++) { yogun.stars[String(n)] = 1; yogun.highScores[String(n)] = 1; }
const s1 = sanitizeSave(yogun);
console.log('   yogun sahte kayit -> maxLevel =', say(s1), ' (LEVELS uzunlugu', LEVELS.length + ')');
console.log('   seviye 30 gercek target1 =', LEVELS[29].target1);
console.log('   >>', say(s1) >= 30 ? 'ISTISMAR ACIK — iddia DOGRU' : 'istismar kapali');

console.log('\n=== KONTROL: SEYREK sahte kayit (gecen turun kapattigi) ===');
console.log('   {stars:{30:3}} -> maxLevel =', say(sanitizeSave({ stars: { 30: 3 } })));
console.log('   {highScores:{29:1}} -> maxLevel =', say(sanitizeSave({ highScores: { 29: 1 } })));

console.log('\n=== 2) MESRU OYUNCU ilerlemesini kaybediyor mu? (asiri kirpma sinavi) ===');
const mesru = { stars: {}, highScores: {} };
for (let n = 1; n <= 7; n++) {
  mesru.highScores[String(n)] = LEVELS[n - 1].target3;   // gercekten 3 yildiz kazanmis
  mesru.stars[String(n)] = 3;
}
const s2 = sanitizeSave(mesru);
console.log('   1..7 arasi 3 yildizla kazanmis -> maxLevel =', say(s2), '(beklenen 8)');
console.log('   yildizlar korundu mu:', JSON.stringify(s2.stars));
console.log('   >>', say(s2) === 8 ? 'MESRU ILERLEME KORUNDU' : '🔴 MESRU ILERLEME KAYBOLDU');

console.log('\n=== 3) BOZUK kayit cokertiyor mu? ===');
const bozuklar = [null, undefined, 'metin', 42, [], { coins: '5' }, { coins: 1e400 },
  { stars: null }, { dailyQuests: [{}] }, { lives: -3 }, { highScores: 'x' }];
let cokme = 0;
for (const b of bozuklar) {
  try { const r = sanitizeSave(b); if (!r || typeof r !== 'object') { cokme++; console.log('   BOS DONDU:', JSON.stringify(b)); } }
  catch (e) { cokme++; console.log('   🔴 COKTU:', JSON.stringify(b), '->', e.message.slice(0, 60)); }
}
console.log('   >>', cokme === 0 ? bozuklar.length + '/' + bozuklar.length + ' bozuk kayit COKERTMEDI' : cokme + ' vaka coktu');

console.log('\n=== 4) PARA tavani saldirganin alanindan mi turetiliyor? ===');
const s3 = sanitizeSave({ coins: 1e9, stats: { lifetimeCoinsEarned: 1e9 } });
console.log('   {coins:1e9, lifetimeCoinsEarned:1e9} -> coins =', s3.coins);
console.log('   {coins:1e9, lifetimeCoinsEarned:0}   -> coins =', sanitizeSave({ coins: 1e9, stats: { lifetimeCoinsEarned: 0 } }).coins);
