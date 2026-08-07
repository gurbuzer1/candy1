/**
 * SEVIYE TABLOSU SINAVI — kalibre edilmis egriyi KORUR.
 *
 * ⚠️ 2026-08-07: BU DOSYA ESKIDEN BOTU HIC KOSTURMUYORDU.
 * Yalnizca sayilarin YAPISINI denetliyordu ("hedefler artiyor mu", "t1<t2<t3
 * mu"). Bu yuzden gercek zorluk hatasini ASLA yakalayamadi: uc bagimsiz
 * orneklem seviye 25'ten 26'ya gecme oraninin ARTTIGINI olctu
 * (n=200 %53->%60, n=1000 %51->%57, n=300 %49->%58; ~2.7 sigma). Ayni sicrama
 * 10->11, 15->16, 20->21 gecislerinde de vardi. Hepsi HAMLE SINIRIYDI: hedef
 * +%1,5 artarken hamle +%12 artiyordu, yani "hedef buyudu" ile "seviye
 * zorlasti" AYNI SEY DEGILDIR.
 * Dosyanin sonuna BOTU GERCEKTEN KOSTURAN bir test eklendi.
 *
 * Buradaki yapisal testler zorlugu OLCMEZ; korunan sey olcumden cikan tablonun
 * YAPISAL ozellikleri:
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

/* ================================================================== */
/* ZORLUK EGRISI — BOT GERCEKTEN KOSUYOR                               */
/* ================================================================== */
/**
 * NE OLCULUYOR: motora sadik bassiz oyuncu (qa/autoplay2.mjs) her seviyeyi
 * sonuna kadar oynar; her seviye icin OLCULEN gecme orani cikarilir ve oranin
 * seviyeden seviyeye ARTMADIGI dogrulanir. Yukaridaki yapisal testler bunu
 * goremez — hedefin sayisal olarak buyumesi zorlugun artmasi DEMEK DEGILDIR.
 *
 * ⚠️ RASTGELE KIRMIZI YANAN TEST TESTSIZLIKTEN BETERDIR. Uc onlem alindi:
 *
 * 1) TOHUMLU RNG. Ayni (n, seed) ikilisi ayni sayilari verir; test
 *    deterministiktir, "bazen kirmizi" olmaz.
 *
 * 2) ESLESTIRILMIS ORNEKLEME. Skor dagilimi seviyenin HEDEFLERINE degil
 *    yalnizca hamle sayisina bagli oldugu icin, ayni hamle sayisini paylasan
 *    5'er seviye AYNI ornekten okunur -> 25 grup-ici gecisde gurultu SIFIR.
 *    Kalan 5 hamle-siniri gecisinde de ortak rastgele sayilar kullanilir
 *    ("36 hamlelik i. oyun" = "32 hamlelik i. oyun"un devami), bu da farkin
 *    varyansini ciddi olcude dusurur.
 *
 * 3) TOLERANS BILINEN-KOTU VAKAYLA KALIBRE EDILDI (qa/eski_tablo_kiyas.mjs).
 *    Ayni olcum, ayni 10 tohum, tek fark tablo — n=300'de:
 *      YENI tablo   : en buyuk ters donus +1,7 puan (10 tohumun en kotusu)
 *      TUR 1 tablosu: en buyuk ters donus +4,3 ... +9,3 puan
 *    Yani %3'luk tolerans ikisinin TAM ARASINA dusuyor: bugun yesil, hatanin
 *    geri gelmesi halinde kirmizi. Kullanilan tohum (20260808) kalibrasyonda
 *    KULLANILMADI (kalibrasyon tohumu 20260807) — tablo kendi olcum tohumuna
 *    uydurulmus olmasin diye.
 *
 * SURE: ~20 sn (6 x 300 = 1800 tam oyun). Suite'in geri kalani ~3 sn.
 * KAPSAM DISI: insan oyuncu (bot "acgozlu", insan ~1,5 kat iyi), UI, animasyon.
 */
const { olcumTablosu, tersDonusler } = await import("../qa/monotonluk_dogrula.mjs");

test("ZORLUK EGRISI: bot kosturuluyor, gecme orani seviyeden seviyeye ARTMIYOR", () => {
  const N = 300;
  const TOHUM = 20260808;   // kalibrasyon tohumu DEGIL (o 20260807)
  const TOLERANS = 0.03;    // qa/eski_tablo_kiyas.mjs ile kalibre edildi

  const { oranlar, hamleler } = olcumTablosu(N, TOHUM);
  const ters = tersDonusler(oranlar, hamleler).filter((t) => t.fark > TOLERANS);

  assert.deepEqual(
    ters.map((t) => `${t.alan} sev ${t.sev - 1}->${t.sev}: ` +
      `${(t.onceki * 100).toFixed(1)}% -> ${(t.simdi * 100).toFixed(1)}%` +
      `${t.hamleSiniri ? " [HAMLE SINIRI]" : ""}`),
    [],
    "zorluk egrisi TERS DONUYOR: bu seviyelerde bir sonraki seviye daha KOLAY",
  );

  // -------- KONTROL VAKALARI (ters yon) --------
  // Bunlar olmadan "ozelligi tamamen oldurmek" de yesil gecerdi: butun
  // hedefleri 999999 yapmak gecme oranini her seviyede %0 yapar ve %0 egrisi
  // kusursuz "monoton"dur. Asagidakiler egrinin GERCEKTEN oynanabilir bir
  // bantta oldugunu ve GERCEKTEN indigini olcer.
  const t1 = oranlar.t1;
  const t3 = oranlar.t3;
  assert.ok(
    t1[0] >= 0.85,
    `seviye 1 bir yildiz orani ${(t1[0] * 100).toFixed(0)}% — ilk seviye ACIK ARA gecilebilir olmali`,
  );
  assert.ok(
    t1[29] >= 0.20,
    `seviye 30 bir yildiz orani ${(t1[29] * 100).toFixed(0)}% — son seviye duvar olmamali`,
  );
  assert.ok(
    t1[29] <= 0.65,
    `seviye 30 bir yildiz orani ${(t1[29] * 100).toFixed(0)}% — son seviye bedava olmamali`,
  );
  assert.ok(
    t1[0] - t1[29] >= 0.30,
    `egri inmiyor: sev1 ${(t1[0] * 100).toFixed(0)}% -> sev30 ${(t1[29] * 100).toFixed(0)}% ` +
    "(duz bir egri de 'monoton' sayilir, ama zorluk artmiyor demektir)",
  );
  assert.ok(
    t3[29] > 0,
    "seviye 30'da UCUNCU YILDIZ imkansiz — eski tablonun 19-30 arasindaki hatasi buydu",
  );
});
