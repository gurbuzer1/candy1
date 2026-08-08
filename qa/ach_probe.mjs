import { checkUnlocks } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/utils/achievements.js';

const mk = () => ({
  stats: { lifetimeMatches: 5, lifetimeCascadesBig: 0, lifetimeColorBombs: 0,
           lifetimeCoinsEarned: 0, bestWinStreak: 0 },
  achievements: {}, maxLevel: 12, stars: {}, coins: 50,
});

// A) normal play: unlock, mark true, re-check
let s = mk();
const a1 = checkUnlocks(s);
for (const d of a1.newlyUnlocked) s.achievements[d.id] = true;
const a2 = checkUnlocks(s);
console.log('A) 1. cagri:', a1.newlyUnlocked.map(d=>d.id).join(','), '+' + a1.rewardCoins);
console.log('A) 2. cagri:', a2.newlyUnlocked.map(d=>d.id).join(',') || '(yok)', '+' + a2.rewardCoins);

// B) tampered save: flag written as false
s.achievements.first_match = false;
const b = checkUnlocks(s);
console.log('B) first_match=false ->', b.newlyUnlocked.map(d=>d.id).join(',') || '(yok)', '+' + b.rewardCoins);

// C) tampered save: achievements key deleted entirely (same class, no `false` needed)
let s2 = mk();
const c1 = checkUnlocks(s2);
for (const d of c1.newlyUnlocked) s2.achievements[d.id] = true;
delete s2.achievements;
const c2 = checkUnlocks(s2);
console.log('C) achievements silindi ->', c2.newlyUnlocked.map(d=>d.id).join(',') || '(yok)', '+' + c2.rewardCoins);

// D) MAGNITUDE: max coins recoverable per tamper via flag-flip, vs direct coin edit
let s3 = mk();
s3.stats = { lifetimeMatches: 999, lifetimeCascadesBig: 999, lifetimeColorBombs: 999,
             lifetimeCoinsEarned: 99999, bestWinStreak: 99 };
s3.maxLevel = 30;
s3.stars = Object.fromEntries(Array.from({length: 12}, (_, i) => [i + 1, 3]));
const d = checkUnlocks(s3);
console.log('D) TUM basarimlar bir seferde ->', d.newlyUnlocked.length, 'adet, +' + d.rewardCoins, 'coin/tur');
console.log('D) karsilastirma: ayni dosyada "coins": 999999 yazmak = tek adimda sinirsiz');

// E) does anything in the shipped code EVER write false? (static check)
import { readFileSync, readdirSync, statSync } from 'node:fs';
const root = 'C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1';
const hits = [];
(function walk(p) {
  for (const f of readdirSync(p)) {
    if (f === 'node_modules' || f === '.git' || f === 'tests') continue;
    const fp = p + '/' + f;
    if (statSync(fp).isDirectory()) walk(fp);
    else if (f.endsWith('.js')) {
      readFileSync(fp, 'utf8').split('\n').forEach((l, i) => {
        if (/achievements\s*(\[|\.)[^=]*=\s*(false|0|null|undefined)/.test(l)) hits.push(`${fp}:${i+1}: ${l.trim()}`);
      });
    }
  }
})(root);
console.log('E) urun kodunda achievements[..]=false/0/null yazan satir:', hits.length ? hits : 'YOK');
