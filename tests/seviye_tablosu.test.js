/**
 * SEVIYE TABLOSU SINAVI — kalibre edilmis egriyi KORUR.
 *
 * Bu testler zorlugu OLCMEZ (olcum qa/kalibrasyon.mjs'in isi, 400-2000 oyun
 * surer ve rastgeledir; birim testine girmez). Burada korunan sey, olcumden
 * cikan tablonun YAPISAL ozellikleri:
 *
 *   - hamle limiti pozitif ve makul,
 *   - target1 < target2 < target3 (yildizlar birbirini gecmiyor),
 *   - hedefler seviyeden seviyeye ARTIYOR (egri geri gitmiyor),
 *   - hamle sayisi geri gitmiyor (skor kabaca hamleyle buyudugu icin hamlenin
 *     azalmasi + hedefin artmasi eski tablonun kirilma noktasiydi: sev 25'te
 *     10 hamleyle 18.000 isteniyordu, olculen medyan 3.298 idi),
 *   - hedefler hamle basina makul bir bantta (bir seviye tek basina
 *     ulasilamaz hale getirilemesin).
 *
 * ⚠️ YESIL SUITE KANIT DEGILDIR: bu dosya "tablo tutarli" der, "zorluk dogru"
 * DEMEZ. Zorluk kaniti qa/seviye_kalibrasyonu.md icindeki olcum tablosudur.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { LEVELS } from "../src/constants/levels.js";

// storage.js AsyncStorage'i import ediyor -> once loader hook'u kurulmali,
// bu yuzden DINAMIK import (durum_dayanikliligi.test.js ile ayni desen).
import "./qa_hooks.mjs";
const { computeStars } = await import("../src/utils/storage.js");

test("30 seviye var", () => {
  assert.equal(LEVELS.length, 30);
});

test("her seviyenin hamle limiti pozitif tam sayi", () => {
  LEVELS.forEach((lv, i) => {
    assert.ok(Number.isInteger(lv.moves), `sev ${i + 1}: hamle tam sayi degil`);
    assert.ok(lv.moves > 0, `sev ${i + 1}: hamle limiti pozitif degil (${lv.moves})`);
    // Ust sinir: oynanabilirlik. 60'i asan bir seviye tabloya yanlislikla
    // girmis demektir.
    assert.ok(lv.moves <= 60, `sev ${i + 1}: hamle limiti absurt (${lv.moves})`);
  });
});

test("her seviyede target1 < target2 < target3", () => {
  LEVELS.forEach((lv, i) => {
    assert.ok(lv.target1 > 0, `sev ${i + 1}: target1 pozitif degil`);
    assert.ok(lv.target1 < lv.target2, `sev ${i + 1}: target1 (${lv.target1}) < target2 (${lv.target2}) degil`);
    assert.ok(lv.target2 < lv.target3, `sev ${i + 1}: target2 (${lv.target2}) < target3 (${lv.target3}) degil`);
  });
});

test("hedefler seviyeden seviyeye KESIN artiyor", () => {
  for (let i = 1; i < LEVELS.length; i++) {
    const a = LEVELS[i - 1], b = LEVELS[i];
    assert.ok(b.target1 > a.target1, `sev ${i + 1}: target1 artmiyor (${a.target1} -> ${b.target1})`);
    assert.ok(b.target2 > a.target2, `sev ${i + 1}: target2 artmiyor (${a.target2} -> ${b.target2})`);
    assert.ok(b.target3 > a.target3, `sev ${i + 1}: target3 artmiyor (${a.target3} -> ${b.target3})`);
  }
});

test("hamle sayisi seviyeden seviyeye AZALMIYOR", () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(
      LEVELS[i].moves >= LEVELS[i - 1].moves,
      `sev ${i + 1}: hamle azaliyor (${LEVELS[i - 1].moves} -> ${LEVELS[i].moves}); ` +
      `hedef artarken hamle azalirsa zorluk sicrar -- eski tablonun hatasi buydu`,
    );
  }
});

test("hamle basina hedef makul bantta (olculen medyan ~900/hamle)", () => {
  // Olcum (qa/kalibrasyon.mjs, 400 oyun): acgozlu botun medyan skoru hamle
  // basina ~870-990 puan. target1 bunun 2 katini ASMAMALI, yoksa seviye
  // otomatik oyuncu icin de insan icin de duvar olur.
  LEVELS.forEach((lv, i) => {
    const perMove = lv.target1 / lv.moves;
    assert.ok(perMove <= 1800, `sev ${i + 1}: target1 hamle basina ${perMove.toFixed(0)} -- olculen medyanin 2 katindan fazla`);
    assert.ok(perMove >= 100, `sev ${i + 1}: target1 hamle basina ${perMove.toFixed(0)} -- bedava`);
  });
});

test("3 yildiz esigi hamle basina ulasilabilir bantta", () => {
  // 400 oyunda olculen p95 hamle basina ~1500-1900 puan. target3 bunun 2
  // katini asarsa 3 yildiz IMKANSIZ olur -- eski tabloda seviye 19-30'da tam
  // olarak bu olmustu (olculen 3 yildiz orani %0).
  LEVELS.forEach((lv, i) => {
    const perMove = lv.target3 / lv.moves;
    assert.ok(perMove <= 3000, `sev ${i + 1}: target3 hamle basina ${perMove.toFixed(0)} -- imkansiz bolgede`);
  });
});

test("computeStars tabloyla tutarli: her esikte dogru yildiz", () => {
  LEVELS.forEach((lv, i) => {
    assert.equal(computeStars(lv.target1 - 1, lv), 0, `sev ${i + 1}`);
    assert.equal(computeStars(lv.target1, lv), 1, `sev ${i + 1}`);
    assert.equal(computeStars(lv.target2 - 1, lv), 1, `sev ${i + 1}`);
    assert.equal(computeStars(lv.target2, lv), 2, `sev ${i + 1}`);
    assert.equal(computeStars(lv.target3 - 1, lv), 2, `sev ${i + 1}`);
    assert.equal(computeStars(lv.target3, lv), 3, `sev ${i + 1}`);
  });
});
