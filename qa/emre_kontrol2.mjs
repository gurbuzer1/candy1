// CELISKIYI COZ: ben deriveMaxLevel'i SANITIZE EDILMIS alanlarla cagirdim.
// Ajan ise ekranin okudugu alana bakti. Ikisini YAN YANA bas.
import { sanitizeSave, deriveMaxLevel, levelWon } from '../src/utils/storage.js';

const yogun = { stars: {}, highScores: {} };
for (let n = 1; n <= 30; n++) { yogun.stars[String(n)] = 1; yogun.highScores[String(n)] = 1; }

const s = sanitizeSave(yogun);
console.log('sanitizeSave(...) DONEN kaydin kendi alanlari:');
console.log('   s.maxLevel            =', s.maxLevel, '   <-- EKRANIN OKUDUGU ALAN');
console.log('   s.stars               =', JSON.stringify(s.stars));
console.log('   s.highScores anahtar  =', Object.keys(s.highScores || {}).length);
console.log('');
console.log('HAM (sanitize edilmemis) girdiyle:');
console.log('   deriveMaxLevel(HAM)   =', deriveMaxLevel(yogun.stars, yogun.highScores));
console.log('   levelWon(1, HAM)      =', levelWon(1, yogun.stars, yogun.highScores));
console.log('   levelWon(30, HAM)     =', levelWon(30, yogun.stars, yogun.highScores));
console.log('');
console.log('SANITIZE EDILMIS alanlarla (benim ilk olcumum):');
console.log('   deriveMaxLevel(TEMIZ) =', deriveMaxLevel(s.stars, s.highScores));
console.log('');
console.log('>>> Ekranin gordugu sey s.maxLevel. Istismar', s.maxLevel >= 30 ? 'ACIK' : 'KAPALI');
