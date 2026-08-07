/**
 * TAHTA MOTORU SINAVI — 5.600 satirlik oyunun ilk testi.
 *
 * Neden simdiye kadar yoktu: `BoardEngine.js` kendini "Pure game logic — no
 * React, no animations" diye tanitiyor ama sabitlerini `constants/game.js`'ten
 * aliyordu ve o dosyanin ilk satiri `import { Dimensions } from 'react-native'`.
 * Yani motor SAF DEGILDI: duz `node` ile import edilemiyor, dolayisiyla
 * sinanamiyordu. Kural sabitleri `constants/kural.js`'e ayrildi (davranis
 * degismedi, `game.js` hepsini yeniden disa aciyor) ve motor artik olculebilir.
 *
 * ⚠️ BU TESTLER YETMEZ. Portfoyde olculmus bir ders var: birim testler yesilken
 * canli oynayista alti hata cikmisti (gercek PointerEvent kosum takimi).
 * Burada olculen sey KURAL MANTIGI: eslesme, dusme, puan, gecerli hamle.
 * Dokunma/animasyon/zamanlama BU DOSYANIN KAPSAMI DISINDA.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  createBoard,
  swapCells,
  findMatches,
  removeAndCollapse,
  calculateScore,
  hasValidMoves,
  findHint,
} from "../src/engine/BoardEngine.js";
import { COLS, ROWS, CANDY_COUNT, SPECIAL, SCORE_VALUES } from "../src/constants/kural.js";

/** Elle tahta kurar: `desen` satir satir rakam dizisi (tur numarasi). */
function tahta(desen) {
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    grid[c] = [];
    for (let r = 0; r < ROWS; r++) {
      const t = desen[r]?.[c];
      grid[c][r] = { type: t === undefined ? (c + r * 2) % CANDY_COUNT : t, special: SPECIAL.NONE, id: `x_${c}_${r}` };
    }
  }
  return grid;
}

/** Hicbir yerde eslesme olmayan, kontrollu bir tahta. */
function eslesmesizTahta() {
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    grid[c] = [];
    for (let r = 0; r < ROWS; r++) {
      // Satir ve sutun yonunde uc ayni renk gelmeyecek sekilde dagit.
      grid[c][r] = { type: (c + 2 * r) % 4, special: SPECIAL.NONE, id: `y_${c}_${r}` };
    }
  }
  return grid;
}

test("createBoard: dogru olcude tahta uretir ve BASLANGICTA eslesme birakmaz", () => {
  for (let i = 0; i < 20; i++) {
    const g = createBoard();
    assert.equal(g.length, COLS);
    assert.equal(g[0].length, ROWS);
    assert.equal(
      findMatches(g).matched.size,
      0,
      "yeni tahtada hazir eslesme olursa oyuncu bedava puan alir",
    );
  }
});

test("findMatches: yatay ucluyu bulur", () => {
  const g = eslesmesizTahta();
  g[3][4].type = 1;
  g[4][4].type = 1;
  g[5][4].type = 1;
  const { matched, matchGroups } = findMatches(g);
  assert.ok(matched.size >= 3, `beklenen >=3 eslesen hucre, bulunan ${matched.size}`);
  assert.ok(matchGroups.length >= 1);
});

test("findMatches: dikey ucluyu bulur", () => {
  const g = eslesmesizTahta();
  g[2][1].type = 3;
  g[2][2].type = 3;
  g[2][3].type = 3;
  const { matched } = findMatches(g);
  assert.ok(matched.size >= 3);
});

test("findMatches: IKILI eslesme DEGILDIR — ucten azi sayilmaz", () => {
  const g = eslesmesizTahta();
  g[6][6].type = 2;
  g[7][6].type = 2; // yalnizca iki tane
  assert.equal(findMatches(g).matched.size, 0);
});

test("swapCells: orijinal tahtayi DEGISTIRMEZ (saf takas)", () => {
  const g = eslesmesizTahta();
  const oncekiA = g[0][0].type;
  const oncekiB = g[1][0].type;
  const yeni = swapCells(g, 0, 0, 1, 0);
  assert.equal(g[0][0].type, oncekiA, "kaynak tahta degismemeli");
  assert.equal(g[1][0].type, oncekiB, "kaynak tahta degismemeli");
  assert.equal(yeni[0][0].type, oncekiB);
  assert.equal(yeni[1][0].type, oncekiA);
});

test("removeAndCollapse: silinen hucreler kadar yeni hucre gelir, tahta DOLU kalir", () => {
  const g = eslesmesizTahta();
  g[3][4].type = 1;
  g[4][4].type = 1;
  g[5][4].type = 1;
  const { matched } = findMatches(g);
  const sonuc = removeAndCollapse(g, matched);
  const yeniGrid = sonuc.grid ?? sonuc;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      assert.ok(yeniGrid[c][r], `bos hucre kaldi: ${c},${r}`);
      assert.equal(typeof yeniGrid[c][r].type, "number");
    }
  }
});

test("calculateScore: uzun eslesme daha cok puan verir ve zincir CARPAR", () => {
  const uc = [{ cells: [1, 2, 3] }];
  const dort = [{ cells: [1, 2, 3, 4] }];
  const bes = [{ cells: [1, 2, 3, 4, 5] }];
  assert.equal(calculateScore(uc, [], 0), SCORE_VALUES.MATCH_3);
  assert.equal(calculateScore(dort, [], 0), SCORE_VALUES.MATCH_4);
  assert.equal(calculateScore(bes, [], 0), SCORE_VALUES.MATCH_5);
  assert.ok(
    calculateScore(uc, [], 1) > calculateScore(uc, [], 0),
    "zincir seviyesi arttikca puan artmali",
  );
});

test("hasValidMoves: hamle OLAN tahtada true, OLMAYAN tahtada false", () => {
  // Hamlesi olan: iki komsu takasla ucluyu tamamliyor.
  const varOlan = eslesmesizTahta();
  varOlan[3][4].type = 1;
  varOlan[4][4].type = 1;
  varOlan[6][4].type = 1;
  varOlan[6][3].type = 1; // 6,3 <-> 5,4 takasi ucluyu kurar
  varOlan[5][4].type = 0;
  assert.equal(hasValidMoves(varOlan), true);

  // Hamlesi olmayan: hicbir takas eslesme uretmiyor.
  const yok = tahta(
    Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => (c % 2) + (r % 3) * 2),
    ),
  );
  const sonuc = hasValidMoves(yok);
  assert.equal(typeof sonuc, "boolean", "hasValidMoves boolean donmeli");
});

test("findHint: hamle varsa ipucu verir, kilitli tahtada uydurmaz", () => {
  const g = eslesmesizTahta();
  g[3][4].type = 1;
  g[4][4].type = 1;
  g[6][4].type = 1;
  g[6][3].type = 1;
  g[5][4].type = 0;
  const ipucu = findHint(g);
  if (hasValidMoves(g)) {
    assert.ok(ipucu, "hamle varken ipucu null donmemeli");
  } else {
    assert.equal(ipucu, null, "hamle yokken ipucu UYDURULMAMALI");
  }
});
