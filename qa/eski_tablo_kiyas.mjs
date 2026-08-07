/**
 * OLCUMUN AYIRT EDICILIGI — "bilinen-KOTU vaka" ile kalibrasyon.
 *
 * `tests/seviye_tablosu.test.js`'in bot kosturan testi bir TOLERANS kullaniyor.
 * Tolerans anlamli mi? Bunu anlamanin tek yolu, olcumu BILINEN KOTU bir tabloya
 * uygulamak: TUR 1 tablosu (dogrulama ajanlarinin "25->26'da zorluk ters
 * donuyor" dedigi tablo). Ayni olcum, ayni tohumlar, tek fark tablo.
 *
 * Kullanim: node qa/eski_tablo_kiyas.mjs [n] [seed1,seed2,...]
 */
import { orneklemHamle } from './autoplay2.mjs';
import { LEVELS as YENI } from '../src/constants/levels.js';

/** TUR 1 tablosu — levels.js icindeki yorumdan birebir. */
const TUR1 = [
  { moves: 20, target1: 4000, target2: 14000, target3: 21500 },
  { moves: 20, target1: 8000, target2: 14500, target3: 22000 },
  { moves: 20, target1: 8500, target2: 15500, target3: 22500 },
  { moves: 20, target1: 9000, target2: 16000, target3: 23000 },
  { moves: 20, target1: 9500, target2: 16500, target3: 23500 },
  { moves: 22, target1: 10500, target2: 19000, target3: 27000 },
  { moves: 22, target1: 11000, target2: 19500, target3: 27500 },
  { moves: 22, target1: 11500, target2: 20000, target3: 28000 },
  { moves: 22, target1: 12000, target2: 20500, target3: 28500 },
  { moves: 22, target1: 12500, target2: 21000, target3: 29000 },
  { moves: 25, target1: 16500, target2: 26000, target3: 31500 },
  { moves: 25, target1: 17000, target2: 26500, target3: 32000 },
  { moves: 25, target1: 17500, target2: 27000, target3: 32500 },
  { moves: 25, target1: 18000, target2: 27500, target3: 33000 },
  { moves: 25, target1: 18500, target2: 28000, target3: 33500 },
  { moves: 28, target1: 22000, target2: 31000, target3: 38500 },
  { moves: 28, target1: 22500, target2: 31500, target3: 39000 },
  { moves: 28, target1: 23000, target2: 32000, target3: 39500 },
  { moves: 28, target1: 23500, target2: 32500, target3: 40000 },
  { moves: 28, target1: 24000, target2: 33000, target3: 41000 },
  { moves: 32, target1: 28500, target2: 39000, target3: 46500 },
  { moves: 32, target1: 29000, target2: 39500, target3: 47000 },
  { moves: 32, target1: 29500, target2: 40000, target3: 47500 },
  { moves: 32, target1: 30000, target2: 40500, target3: 48500 },
  { moves: 32, target1: 30500, target2: 41000, target3: 49000 },
  { moves: 36, target1: 34500, target2: 46000, target3: 55000 },
  { moves: 36, target1: 35000, target2: 46500, target3: 56000 },
  { moves: 36, target1: 35500, target2: 47000, target3: 58000 },
  { moves: 36, target1: 36000, target2: 47500, target3: 59000 },
  { moves: 36, target1: 36500, target2: 48000, target3: 60000 },
];

const n = Number(process.argv[2] || 250);
const seeds = (process.argv[3] || '11,22,33,44,55,66,77').split(',').map(Number);
const oran = (S, v) => S.filter((s) => s >= v).length / S.length;

function enBuyukTersDonus(tablo, ornekler) {
  let en = 0; let nerede = '';
  for (const alan of ['target1', 'target2', 'target3']) {
    for (let i = 1; i < tablo.length; i++) {
      const a = oran(ornekler.get(tablo[i - 1].moves), tablo[i - 1][alan]);
      const b = oran(ornekler.get(tablo[i].moves), tablo[i][alan]);
      if (b - a > en) { en = b - a; nerede = `${alan} sev ${i}->${i + 1} (${(a * 100).toFixed(1)}% -> ${(b * 100).toFixed(1)}%)`; }
    }
  }
  return { en, nerede };
}

let yeniEn = 0; let eskiEn = 0;
for (const seed of seeds) {
  const ornekler = new Map();
  for (const m of [...new Set([...TUR1, ...YENI].map((l) => l.moves))]) {
    ornekler.set(m, orneklemHamle(m, n, seed));
  }
  const y = enBuyukTersDonus(YENI, ornekler);
  const e = enBuyukTersDonus(TUR1, ornekler);
  if (y.en > yeniEn) yeniEn = y.en;
  if (e.en > eskiEn) eskiEn = e.en;
  console.log(`seed=${seed} n=${n}`);
  console.log(`   YENI tablo en buyuk ters donus: +${(y.en * 100).toFixed(1)} puan  ${y.nerede}`);
  console.log(`   TUR1 tablo en buyuk ters donus: +${(e.en * 100).toFixed(1)} puan  ${e.nerede}`);
}
console.log(`\nTUM TOHUMLAR: YENI max +${(yeniEn * 100).toFixed(1)} puan | TUR1 max +${(eskiEn * 100).toFixed(1)} puan`);
