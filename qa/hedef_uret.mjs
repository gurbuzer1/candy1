/**
 * hedef_uret.mjs — 30 seviyenin hedeflerini OLCUMDEN turetir.
 *
 * Girdi : qa/kalibrasyon.mjs'in `dagilim()` fonksiyonu (tohumlu, tekrarlanabilir).
 * Cikti : onerilen LEVELS tablosu + gecme oranlari (stdout, JSON dosyasi).
 *
 * TASARIM KURALI (hepsi olculen dagilimin YUZDELIKLERINDEN turetilir):
 *   target1 : otomatik oyuncunun p(t1) yuzdeligi. Seviye 1'de p02 (herkes gecer),
 *             seviye 30'da p45 (otomatik oyuncunun %55'i gecer).
 *   target2 : p35 -> p80
 *   target3 : p70 -> p97   (nadir, ama HICBIR seviyede %0 degil)
 *
 * Hamle sayisi MONOTON ARTAR (20 -> 36). Nedeni: hedeflerin sayisal olarak da
 * artmasi isteniyor; skor ~hamle ile buyudugu icin hamleyi dusurup hedefi
 * yukseltmek matematiksel olarak imkansizdi (eski tablonun kirilma noktasi
 * tam buydu: sev25'te 10 hamleyle 18.000 isteniyordu, olculen medyan 3.298).
 */
import { dagilim } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/qa/kalibrasyon.mjs';
import { writeFileSync } from 'node:fs';

const RUNS = Number(process.argv[2] || 400);

// 30 seviyelik hamle programi — monoton artan, 6 blok.
const MOVES = [];
const BLOKLAR = [20, 22, 25, 28, 32, 36];
for (const m of BLOKLAR) for (let k = 0; k < 5; k++) MOVES.push(m);

const lerp = (a, b, t) => a + (b - a) * t;
const P1 = [0.02, 0.45];
const P2 = [0.35, 0.80];
const P3 = [0.70, 0.97];

function pctOf(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
const yuvarla = (x) => Math.max(500, Math.round(x / 500) * 500);

// Her farkli hamle sayisi icin bir kez dagilim olc.
const dist = {};
for (const m of new Set(MOVES)) {
  process.stderr.write(`olculuyor: ${m} hamle x ${RUNS} oyun...\n`);
  dist[m] = dagilim(m, RUNS, 'acgozlu', 20260807 + m);
}

const out = [];
let prev1 = 0, prev2 = 0, prev3 = 0;
let prevR1 = 101, prevR2 = 101, prevR3 = 101;
for (let i = 0; i < 30; i++) {
  const t = i / 29;
  const sc = dist[MOVES[i]].skorlar;
  const rate = (v) => +(100 * sc.filter(s => s >= v).length / sc.length).toFixed(0);
  let t1 = yuvarla(pctOf(sc, lerp(P1[0], P1[1], t)));
  let t2 = yuvarla(pctOf(sc, lerp(P2[0], P2[1], t)));
  let t3 = yuvarla(pctOf(sc, lerp(P3[0], P3[1], t)));
  // Seviyeler arasi KESIN artis (yuvarlama duzlestirebilir).
  t1 = Math.max(t1, prev1 + 500);
  t2 = Math.max(t2, prev2 + 500, t1 + 1000);
  t3 = Math.max(t3, prev3 + 500, t2 + 1000);
  // MONOTON ZORLUK — sayisal hedefin artmasi yetmez, OLCULEN gecme orani da
  // dusmeli. Hamle sayisi blok basinda sicradigi icin (20->22->25...) ayni
  // hedef bir onceki seviyeden KOLAY olabiliyordu; hedefi 500'luk adimlarla
  // yukari it ki olculen oran onceki seviyeyi ASMASIN.
  let guard = 0;
  while (rate(t1) > prevR1 && guard++ < 400) t1 += 500;
  guard = 0;
  while ((rate(t2) > prevR2 || t2 < t1 + 1000) && guard++ < 400) t2 += 500;
  guard = 0;
  while ((rate(t3) > prevR3 || t3 < t2 + 1000) && guard++ < 400) t3 += 500;
  prev1 = t1; prev2 = t2; prev3 = t3;
  prevR1 = rate(t1); prevR2 = rate(t2); prevR3 = rate(t3);
  out.push({
    seviye: i + 1, moves: MOVES[i], target1: t1, target2: t2, target3: t3,
    p50: Math.round(pctOf(sc, 0.5)),
    p25: Math.round(pctOf(sc, 0.25)),
    p75: Math.round(pctOf(sc, 0.75)),
    oran1: rate(t1), oran2: rate(t2), oran3: rate(t3), oyun: RUNS,
  });
}

console.log('sev | hml |    p25 |    p50 |    p75 |     t1 /     t2 /     t3 | %>=t1 | %>=t2 | %>=t3');
for (const r of out) {
  console.log('%s | %s | %s | %s | %s | %s / %s / %s | %s%% | %s%% | %s%%',
    String(r.seviye).padStart(3), String(r.moves).padStart(3),
    String(r.p25).padStart(6), String(r.p50).padStart(6), String(r.p75).padStart(6),
    String(r.target1).padStart(6), String(r.target2).padStart(6), String(r.target3).padStart(6),
    String(r.oran1).padStart(4), String(r.oran2).padStart(4), String(r.oran3).padStart(4));
}
console.log('\n--- levels.js govdesi ---');
for (const r of out) {
  console.log(`  { moves: ${r.moves}, target1: ${r.target1}, target2: ${r.target2}, target3: ${r.target3} },`);
}
writeFileSync(
  'C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/qa/hedef_olcum.json',
  JSON.stringify({ runs: RUNS, uretildi: new Date().toISOString(), satirlar: out }, null, 2),
);
