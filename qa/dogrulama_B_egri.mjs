/**
 * BAGIMSIZ DOGRULAMA — B) ZORLUK EGRISI, KENDI OLCUMUM
 *
 * Duzeltmeyi yapan ajan "eslestirilmis ornekleme" kullaniyor (ayni hamle
 * sayisini paylasan seviyeler AYNI orneklemden okunuyor). O olcum gurultuyu
 * dusuruyor ama kendi varsayimina dayaniyor. Burada IKI SEY yapilir:
 *
 *   (1) BAGIMSIZ ORNEKLEM: her seviye AYRI AYRI n kez oynanir (playLevel'in
 *       kendi levelIdx'iyle). Egri ve ters donusler raporlanir.
 *   (2) VARSAYIM SINAVI: "skor yalnizca hamle sayisina bagli" iddiasi olculur
 *       -- ayni hamle sayisina sahip iki FARKLI seviye ayni ortalamayi mi verir?
 *   (3) TOHUM DAYANIKLILIGI: testin kullandigi TEK tohum disinda 10 taze
 *       tohumla en buyuk ters donus olculur (test tohuma uydurulmus mu?).
 *
 * Kullanim: node qa/dogrulama_B_egri.mjs [n]
 */
import { playLevel, orneklem, tohumlaKostur } from "./autoplay2.mjs";
import { olcumTablosu, tersDonusler } from "./monotonluk_dogrula.mjs";
import { LEVELS } from "../src/constants/levels.js";

const N = Number(process.argv[2] || 500);

// ---------------------------------------------------------------------------
console.log(`=== (1) BAGIMSIZ ORNEKLEM — her seviye AYRI, n=${N} ===`);
const t0 = Date.now();
const skorlar = [];
for (let i = 0; i < LEVELS.length; i++) {
  // Her seviyeye FARKLI ve testin kullanmadigi bir tohum.
  const s = tohumlaKostur(910000 + i * 7717, () => {
    const out = [];
    for (let k = 0; k < N; k++) out.push(playLevel(i).score);
    return out;
  });
  skorlar.push(s);
}
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} sn, ${N * LEVELS.length} tam oyun)\n`);

const oran = (S, v) => S.filter((x) => x >= v).length / S.length;
const t1 = LEVELS.map((lv, i) => oran(skorlar[i], lv.target1));
const t2 = LEVELS.map((lv, i) => oran(skorlar[i], lv.target2));
const t3 = LEVELS.map((lv, i) => oran(skorlar[i], lv.target3));
const ort = skorlar.map((S) => S.reduce((a, b) => a + b, 0) / S.length);

console.log("  sev " + LEVELS.map((_, i) => String(i + 1).padStart(4)).join(""));
console.log("  1y  " + t1.map((v) => (v * 100).toFixed(0).padStart(4)).join(""));
console.log("  2y  " + t2.map((v) => (v * 100).toFixed(0).padStart(4)).join(""));
console.log("  3y  " + t3.map((v) => (v * 100).toFixed(0).padStart(4)).join(""));
console.log("  hm  " + LEVELS.map((l) => String(l.moves).padStart(4)).join(""));

console.log("\n  TERS DONUSLER (bagimsiz orneklem, gurultu ~+-3 puan):");
let enBuyukBagimsiz = 0, sayi = 0;
for (const [ad, dizi] of [["1y", t1], ["2y", t2], ["3y", t3]]) {
  for (let i = 1; i < dizi.length; i++) {
    const fark = dizi[i] - dizi[i - 1];
    if (fark > 0) {
      sayi++;
      if (fark > enBuyukBagimsiz) enBuyukBagimsiz = fark;
      const sinir = LEVELS[i].moves !== LEVELS[i - 1].moves ? "  [HAMLE SINIRI]" : "";
      console.log(`    ${ad} sev ${i}->${i + 1}: ${(dizi[i - 1] * 100).toFixed(1)}% -> ${(dizi[i] * 100).toFixed(1)}%  (+${(fark * 100).toFixed(1)} puan)${sinir}`);
    }
  }
}
if (sayi === 0) console.log("    (YOK)");
console.log(`  EN BUYUK TERS DONUS (bagimsiz) = +${(enBuyukBagimsiz * 100).toFixed(1)} puan`);

console.log("\n  25->26 GECISI (gecen turun bulunan hatasi) — YAKINDAN:");
for (const [ad, dizi] of [["1y", t1], ["2y", t2], ["3y", t3]]) {
  console.log(`    ${ad}: sev25 ${(dizi[24] * 100).toFixed(1)}%  -> sev26 ${(dizi[25] * 100).toFixed(1)}%  fark ${((dizi[25] - dizi[24]) * 100).toFixed(1)} puan`);
}
console.log(`    ortalama skor: sev25 ${ort[24].toFixed(0)}  sev26 ${ort[25].toFixed(0)}  (hedef t1: ${LEVELS[24].target1} -> ${LEVELS[25].target1})`);

// ---------------------------------------------------------------------------
console.log("\n=== (2) VARSAYIM SINAVI: 'skor YALNIZCA hamle sayisina bagli' ===");
const gruplar = new Map();
LEVELS.forEach((lv, i) => {
  if (!gruplar.has(lv.moves)) gruplar.set(lv.moves, []);
  gruplar.get(lv.moves).push(i);
});
for (const [moves, idxler] of [...gruplar].sort((a, b) => a[0] - b[0])) {
  const ortalamalar = idxler.map((i) => ort[i]);
  const min = Math.min(...ortalamalar), max = Math.max(...ortalamalar);
  const yayilma = ((max - min) / ((max + min) / 2)) * 100;
  console.log(`  ${moves} hamle -> seviyeler ${idxler.map((i) => i + 1).join(",")}  ortalamalar ${ortalamalar.map((v) => v.toFixed(0)).join(", ")}  yayilma %${yayilma.toFixed(1)}`);
}
console.log("  (yayilma orneklem gurultusu kadarsa varsayim SAGLAM; sistematik egilim varsa DEGIL)");

// ---------------------------------------------------------------------------
console.log("\n=== (3) TOHUM DAYANIKLILIGI: 10 TAZE tohum, eslestirilmis olcum, n=300 ===");
console.log("    (testin tohumu 20260808, kalibrasyon tohumu 20260807 -- ikisi de KULLANILMIYOR)");
let enBuyuk = 0, asan = 0;
for (const seed of [11, 222, 3333, 44444, 555555, 60606, 707070, 808081, 909091, 1010101]) {
  const { oranlar, hamleler } = olcumTablosu(300, seed);
  const ters = tersDonusler(oranlar, hamleler);
  const enKotu = ters.reduce((a, b) => (b.fark > a ? b.fark : a), 0);
  if (enKotu > enBuyuk) enBuyuk = enKotu;
  if (enKotu > 0.03) asan++;
  console.log(`    seed=${String(seed).padStart(8)}  ters donus sayisi=${String(ters.length).padStart(2)}  en buyuk=+${(enKotu * 100).toFixed(1)} puan  ${enKotu > 0.03 ? "<-- %3 TOLERANSI ASAR (test bu tohumla KIRMIZI olurdu)" : ""}`);
}
console.log(`    10 tohumda EN BUYUK ters donus = +${(enBuyuk * 100).toFixed(1)} puan; toleransi asan tohum sayisi = ${asan}/10`);
