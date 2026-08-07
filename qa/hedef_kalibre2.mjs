/**
 * HEDEF KALIBRASYONU v2 — "zorluk 25->26'da TERS DONUYOR" bulgusunun duzeltmesi.
 *
 * BULGU (uc bagimsiz orneklem): gecme orani 25'ten 26'ya ARTIYOR.
 *   n=200 %53->%60 · n=1000 %51->%57 · n=300 %49->%58  (~2.7 sigma)
 * Ayni sicrama 10->11, 16->17, 20->21 hamle-siniri gecislerinde de vardi.
 * KOK NEDEN: hedefler her seviyede sabit bir miktar artiyordu (+500), ama
 * hamle sayisi 5 seviyede bir SICRIYORDU (20/22/25/28/32/36). Hamle sicradigi
 * seviyede skor dagilimi +%15 kayiyor, hedef ise yalnizca +%1.5 artiyor ->
 * seviye KOLAYLASIYOR.
 *
 * COZUM: hedefi "onceki + 500" diye degil, O SEVIYENIN OLCULEN SKOR
 * DAGILIMINDAN, istenen gecme oranina karsilik gelen YUZDELIK olarak turet;
 * sonra OLCULEN gecme oraninin seviyeden seviyeye ASLA ARTMADIGINI ZORLA.
 *
 * Girdi : qa/skor_dagilimi.json (node qa/skor_dagilimi.mjs 4000)
 * Cikti : yeni LEVELS satirlari (stdout) + qa/hedef_kalibre2.json
 * Kullanim: node qa/hedef_kalibre2.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/constants/levels.js';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dag = JSON.parse(readFileSync(path.join(KOK, 'qa', 'skor_dagilimi.json'), 'utf8'));

const HAMLELER = LEVELS.map((l) => l.moves);
const N = LEVELS.length;

// Istenen gecme orani egrileri — seviye 1'den 30'a KESIN AZALAN.
const ISTENEN = {
  target1: (i) => 0.97 - (0.97 - 0.44) * (i / (N - 1)),
  target2: (i) => 0.60 - (0.60 - 0.15) * (i / (N - 1)),
  target3: (i) => 0.25 - (0.25 - 0.03) * (i / (N - 1)),
};

const ornek = (i) => dag.hamleler[HAMLELER[i]];
const oran = (S, v) => S.filter((s) => s >= v).length / S.length;

/** `p` orani ASILMAYACAK sekilde en kucuk 100'un kati hedef. */
function hedefIcin(S, p) {
  const n = S.length;
  const k = Math.floor(p * n);              // en fazla bu kadar oyun gecsin
  if (k <= 0) return Math.ceil((S[n - 1] + 1) / 100) * 100;
  let v = Math.ceil(S[n - k] / 100) * 100;
  let guvenlik = 0;
  while (oran(S, v) > p && guvenlik++ < 10000) v += 100;
  return v;
}

/**
 * HAMLE SINIRI PAYI. Grup ici gecisler ayni ornekten okundugu icin gurultusuz;
 * gurultu YALNIZCA hamle sayisinin degistigi 5 gecistedir (10->11, 15->16,
 * 20->21, 25->26 ve 5->6). Orada oran farkini SIFIRIN hemen altina degil,
 * olcum gurultusunun UZAGINA koyariz ki bagimsiz bir tohumda isaret degistirip
 * "ters donus" gorunmesin. Olculen paired gurultu (n=250, 5 tohum) ~2-3 puan.
 */
const SINIR_PAYI = 0.03;

const cikti = [];
for (const alan of ['target1', 'target2', 'target3']) {
  let oncekiHedef = 0;
  let oncekiOran = 1.1;
  const sutun = [];
  for (let i = 0; i < N; i++) {
    const S = ornek(i);
    const sinir = i > 0 && HAMLELER[i] !== HAMLELER[i - 1];
    const tavan = Math.max(0, oncekiOran - (sinir ? SINIR_PAYI : 0));
    let v = hedefIcin(S, Math.min(ISTENEN[alan](i), tavan));
    if (v <= oncekiHedef) v = oncekiHedef + 100;               // KESIN artan hedef
    let guvenlik = 0;
    while (oran(S, v) > tavan && guvenlik++ < 10000) v += 100;  // OLCULEN oran ASLA artmaz
    sutun.push(v);
    oncekiHedef = v;
    oncekiOran = oran(S, v);
  }
  cikti.push(sutun);
}

const [t1, t2, t3] = cikti;
// Seviye ici sira: t1 < t2 < t3 (yukaridaki egriler zaten bunu verir, yine de zorla)
for (let i = 0; i < N; i++) {
  if (t2[i] <= t1[i]) t2[i] = t1[i] + 100;
  if (t3[i] <= t2[i]) t3[i] = t2[i] + 100;
}

console.log('sev | hml |  t1   |  t2   |  t3   | %1y  %2y  %3y   (olculen, n=' + dag.N + ')');
const satirlar = [];
for (let i = 0; i < N; i++) {
  const S = ornek(i);
  const p1 = oran(S, t1[i]), p2 = oran(S, t2[i]), p3 = oran(S, t3[i]);
  console.log(
    `${String(i + 1).padStart(3)} | ${String(HAMLELER[i]).padStart(3)} | ${String(t1[i]).padStart(5)} | ${String(t2[i]).padStart(5)} | ${String(t3[i]).padStart(5)} | ` +
    `${(p1 * 100).toFixed(0).padStart(3)}% ${(p2 * 100).toFixed(0).padStart(3)}% ${(p3 * 100).toFixed(0).padStart(3)}%`,
  );
  satirlar.push(
    `  { moves: ${HAMLELER[i]}, target1: ${t1[i]}, target2: ${t2[i]}, target3: ${t3[i]} }, ` +
    `// 1y ${(p1 * 100).toFixed(0)}% 2y ${(p2 * 100).toFixed(0)}% 3y ${(p3 * 100).toFixed(0)}%`,
  );
}

// Monotonluk denetimi (ayni orneklem uzerinde)
let ihlal = 0;
for (const [ad, sut] of [['1y', t1], ['2y', t2], ['3y', t3]]) {
  for (let i = 1; i < N; i++) {
    const a = oran(ornek(i - 1), sut[i - 1]);
    const b = oran(ornek(i), sut[i]);
    if (b > a + 1e-12) { console.log(`⚠️ ${ad} ters donus sev ${i} -> ${i + 1}: ${(a * 100).toFixed(1)}% -> ${(b * 100).toFixed(1)}%`); ihlal++; }
  }
}
console.log('ters donus sayisi:', ihlal);

console.log('\n--- levels.js govdesi ---');
console.log(satirlar.join('\n'));
writeFileSync(path.join(KOK, 'qa', 'hedef_kalibre2.json'), JSON.stringify({ t1, t2, t3, hamleler: HAMLELER }, null, 1));
