/**
 * MOTOR/KURAL DUZELTMELERININ KORUYUCU SINAVI.
 *
 * Bu dosya `tests/tahta_motoru.test.js`'in yerini ALMAZ; onun sinamadigi
 * yollari — ozel seker uretimi, renk bombasi, zincirleme patlama, karistirma
 * ve frenzy tetikleyicisi — kilitler.
 *
 * ⚠️ Her testin basindaki yorum, duzeltmeden ONCE olculen degeri yazar.
 * Testin kirmizi olmasi gereken hali mutasyon sinaviyla dogrulandi
 * (qa/mutasyon_sinavi.mjs).
 *
 * KAPSAM DISI: dokunma, animasyon, zamanlama, React state. Burada olculen sey
 * saf kural mantigi + kaynak seviyesinde "kapi gercekten baglandi mi".
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createBoard,
  swapCells,
  findMatches,
  determineSpecials,
  getSpecialRemovals,
  removeAndCollapse,
  reserveSpecials,
  colorBombSwap,
  isPlayableSwap,
  shuffleBoard,
  hasValidMoves,
} from "../src/engine/BoardEngine.js";
import { COLS, ROWS, SPECIAL } from "../src/constants/kural.js";
import {
  FRENZY_THRESHOLD,
  FRENZY_CHARGE_TARGET,
  frenzyReadyColor,
} from "../src/constants/economy.js";

const KAYNAK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
);

let idn = 0;
/** Eslesmesiz taban tahta: yatayda +1, dikeyde +2 -> ucu asla ayni olmaz. */
function tahta(fn) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    g[c] = [];
    for (let r = 0; r < ROWS; r++) {
      g[c][r] = { type: fn(c, r), special: SPECIAL.NONE, id: `t_${idn++}` };
    }
  }
  return g;
}
const taban = (c, r) => (c + 2 * r) % 6;
function ozelSay(g) {
  let k = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (g[c][r] && g[c][r].special !== SPECIAL.NONE) k++;
  return k;
}

/* ------------------------------------------------------------------ */
/* BULGU 1 — placeSpecials olu kapisi                                  */
/* ------------------------------------------------------------------ */

test("BULGU 1: 4-lu eslesmeden dogan CIZGILI seker collapse SONRASI tahtada DURUR", () => {
  // ONCE: 300 otomatik oyunda eslesmeden konan ozel seker = 0.
  // placeSpecials collapse'tan sonra cagriliyordu ve `=== null` kosulu asla
  // saglanmiyordu (collapse tum bosluklari doldurur).
  const g = tahta((c, r) => (r === 4 && c >= 2 && c <= 5 ? 0 : taban(c, r)));
  const { matched, matchGroups } = findMatches(g);
  const specials = determineSpecials(matchGroups);

  assert.equal(specials.length, 1, "4-lu tam olarak bir ozel uretmeli");
  assert.equal(specials[0].special, SPECIAL.STRIPED_V);

  getSpecialRemovals(g, matched).forEach((k) => matched.add(k));
  const oncekiBoyut = matched.size;

  const res = reserveSpecials(g, matched, specials);
  assert.equal(res.placed.length, 1, "ozel seker REZERVE edilmeli");
  assert.equal(
    res.matched.size,
    oncekiBoyut - 1,
    "rezerve edilen hucre silinecekler kumesinden CIKARILMALI",
  );
  assert.equal(res.grid[3][4].special, SPECIAL.STRIPED_V);

  const { grid: sonra } = removeAndCollapse(res.grid, res.matched);
  assert.equal(
    ozelSay(sonra),
    1,
    "collapse sonrasi ozel seker tahtada KALMALI (ONCE: 0)",
  );
  assert.equal(sonra[3][4].special, SPECIAL.STRIPED_V, "ozel seker yerinde durmali");
});

test("BULGU 1: rezerve edilen hucre yercekiminden ETKILENMEZ, tahta yine DOLU kalir", () => {
  const g = tahta((c, r) => (r === 4 && c >= 2 && c <= 5 ? 0 : taban(c, r)));
  const { matched, matchGroups } = findMatches(g);
  const specials = determineSpecials(matchGroups);
  getSpecialRemovals(g, matched).forEach((k) => matched.add(k));
  const res = reserveSpecials(g, matched, specials);
  const { grid: sonra } = removeAndCollapse(res.grid, res.matched);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      assert.ok(sonra[c][r], `bos hucre kaldi: ${c},${r}`);
    }
  }
});

test("BULGU 1: reserveSpecials KAYNAK tahtayi degistirmez (saf)", () => {
  const g = tahta(taban);
  const oncekiId = g[3][4].id;
  reserveSpecials(g, new Set(["3,4"]), [
    { col: 3, row: 4, type: 0, special: SPECIAL.WRAPPED },
  ]);
  assert.equal(g[3][4].id, oncekiId, "kaynak tahta degismemeli");
  assert.equal(g[3][4].special, SPECIAL.NONE);
});

/* ------------------------------------------------------------------ */
/* BULGU 7 — 5'li dizi onceligi                                        */
/* ------------------------------------------------------------------ */

test("BULGU 7: 5-li dizi baska eslesmeyle KESISSE BILE RENK BOMBASI verir", () => {
  // ONCE: L/T dali once kosuyordu ve 5'linin hucrelerini isaretliyordu ->
  // oyuncu renk bombasi yerine SARMAL aliyordu.
  const g = tahta((c, r) => {
    if (r === 4 && c >= 2 && c <= 6) return 0;
    if (c === 4 && r >= 3 && r <= 5) return 0;
    return taban(c, r);
  });
  const { matchGroups } = findMatches(g);
  const uzunluklar = matchGroups.map((m) => m.cells.length).sort();
  assert.deepEqual(uzunluklar, [3, 5], "kurulum: bir 5-li ve bir 3-lu kesismeli");

  const sp = determineSpecials(matchGroups);
  assert.equal(sp.length, 1);
  assert.equal(
    sp[0].special,
    SPECIAL.COLOR_BOMB,
    "5-li kesisirse RENK BOMBASI olmali (ONCE: SARMAL)",
  );
});

test("BULGU 7: kesisme YOKKEN L/T hala SARMAL verir (duzeltme fazla ileri gitmedi)", () => {
  const g = tahta((c, r) => {
    if (r === 4 && c >= 2 && c <= 4) return 0;   // yatay 3
    if (c === 4 && r >= 3 && r <= 5) return 0;   // dikey 3, (4,4)'te kesisiyor
    return taban(c, r);
  });
  const { matchGroups } = findMatches(g);
  assert.equal(matchGroups.length, 2, "kurulum: iki uclu kesismeli");
  const sp = determineSpecials(matchGroups);
  assert.equal(sp.length, 1);
  assert.equal(sp[0].special, SPECIAL.WRAPPED, "L/T hala sarmal vermeli");
});

/* ------------------------------------------------------------------ */
/* BULGU 6 — zincirleme patlama                                        */
/* ------------------------------------------------------------------ */

test("BULGU 6: patlamanin icinde kalan CIZGILI seker de patlar (zincir)", () => {
  // ONCE: kurban tetiklenmeden siliniyordu; sutun 7'den silinen = 1.
  const g = tahta(taban);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: "patlayan" };
  g[7][4] = { type: 1, special: SPECIAL.STRIPED_V, id: "kurban" };

  const extra = getSpecialRemovals(g, new Set(["4,4"]));
  const sutun7 = [...extra].filter((k) => k.startsWith("7,")).length;
  assert.equal(sutun7, ROWS, `zincir kirik: sutun 7'den ${sutun7} hucre (ONCE: 1)`);
});

test("BULGU 6: getSpecialRemovals SABIT NOKTA'dir — ikinci tur yeni hucre eklemez", () => {
  const g = tahta(taban);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: "a" };
  g[7][4] = { type: 1, special: SPECIAL.STRIPED_V, id: "b" };
  g[7][7] = { type: 2, special: SPECIAL.WRAPPED, id: "c" };

  const birinci = new Set(["4,4"]);
  getSpecialRemovals(g, birinci).forEach((k) => birinci.add(k));
  const ikinci = new Set(birinci);
  getSpecialRemovals(g, ikinci).forEach((k) => ikinci.add(k));
  assert.equal(ikinci.size, birinci.size, "tek gecis sabit noktaya ulasmali");
});

test("BULGU 6: zincir SONSUZ DONGUYE girmez (tahta ozel sekerle dolu)", () => {
  const g = tahta((c, r) => (c + r) % 6);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      g[c][r] = {
        type: (c + r) % 6,
        special: (c + r) % 2 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V,
        id: `f_${c}_${r}`,
      };
  const extra = getSpecialRemovals(g, new Set(["0,0"]));
  assert.ok(extra.size <= COLS * ROWS, "en fazla tahta kadar hucre silinebilir");
  assert.ok(extra.size > COLS, "zincir gercekten yayilmali");
});

/* ------------------------------------------------------------------ */
/* BULGU 3 — RENK BOMBASI                                              */
/* ------------------------------------------------------------------ */

test("BULGU 3: patlamanin icinde kalan RENK BOMBASI kendi patlamasini tetikler", () => {
  // ONCE: getSpecialRemovals'in COLOR_BOMB dali ULASILMAZDI (300 tahta,
  // 5555 takas -> bomba `matched` icine 0 kez girdi; kontrol grubu 228).
  const g = tahta(taban);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: "patlayan" };
  g[6][4] = { ...g[6][4], type: 3 };   // bombanin komsusu, silinecekler icinde
  g[7][4] = { type: 5, special: SPECIAL.COLOR_BOMB, id: "bomba" };

  const extra = getSpecialRemovals(g, new Set(["4,4"]));
  const satirDisi = [...extra].filter((k) => !k.endsWith(",4"));
  assert.ok(
    satirDisi.length > 0,
    `bomba yine olu: satir disi silinen ${satirDisi.length} (ONCE: 0)`,
  );
});

test("BULGU 3: TAKAS ile aktivasyon — bomba + duz seker o rengin TAMAMINI siler", () => {
  const g = tahta(taban);
  g[0][0] = { type: 0, special: SPECIAL.COLOR_BOMB, id: "bomba" };
  const hedefTip = g[1][0].type;
  let ayniTip = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) if (g[c][r].type === hedefTip) ayniTip++;

  const blast = colorBombSwap(g, 0, 0, 1, 0);
  assert.ok(blast, "bomba takasi null donmemeli");
  assert.ok(blast.has("0,0"), "bombanin kendisi de silinmeli");
  assert.equal(
    blast.size,
    ayniTip + 1,
    "hedef renkteki her seker + bomba silinmeli",
  );
});

test("BULGU 3: bomba + bomba TUM tahtayi siler", () => {
  const g = tahta(taban);
  g[0][0] = { type: 0, special: SPECIAL.COLOR_BOMB, id: "b1" };
  g[1][0] = { type: 1, special: SPECIAL.COLOR_BOMB, id: "b2" };
  assert.equal(colorBombSwap(g, 0, 0, 1, 0).size, COLS * ROWS);
});

test("BULGU 3: bombasiz takas null doner (olcum kalibrasyonu)", () => {
  const g = tahta(taban);
  assert.equal(
    colorBombSwap(g, 3, 3, 4, 3),
    null,
    "bomba yokken aktivasyon UYDURULMAMALI",
  );
});

test("BULGU 3: bomba takasi GECERLI HAMLE sayilir (bomba kalici engel degil)", () => {
  const g = tahta(taban);
  // eslesme URETMEYEN bir komsu takas bul
  let hedef = null;
  for (let c = 0; c < COLS - 1 && !hedef; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (findMatches(swapCells(g, c, r, c + 1, r)).matched.size === 0) {
        hedef = [c, r];
        break;
      }
    }
  }
  assert.ok(hedef, "kurulum: olu bir takas bulunmali");
  const [c, r] = hedef;
  assert.equal(isPlayableSwap(g, c, r, c + 1, r), false, "olu takas oynanamaz");

  g[c][r] = { ...g[c][r], special: SPECIAL.COLOR_BOMB };
  assert.equal(
    isPlayableSwap(g, c, r, c + 1, r),
    true,
    "AYNI takas, bomba varken oynanabilir olmali (ONCE: false)",
  );
});

/* ------------------------------------------------------------------ */
/* BULGU 4 / 5 — karistirma                                            */
/* ------------------------------------------------------------------ */

test("BULGU 4: shuffleBoard HAZIR ESLESME birakmaz ve OYNANABILIR tahta verir", () => {
  // ONCE: 300 karistirmanin 287'si (%95.7) hazir eslesme birakiyordu,
  // ortalama 9.5 hucre -> bedava puan + her takas "gecerli" sayiliyordu.
  const N = 120;
  let kirli = 0;
  let hamlesiz = 0;
  for (let i = 0; i < N; i++) {
    const s = shuffleBoard(createBoard());
    if (findMatches(s).matched.size > 0) kirli++;
    if (!hasValidMoves(s)) hamlesiz++;
  }
  assert.equal(kirli, 0, `${N} karistirmanin ${kirli}'i hazir eslesme birakti (ONCE: %95.7)`);
  assert.equal(hamlesiz, 0, `${N} karistirmanin ${hamlesiz}'inde gecerli hamle yok`);
});

test("BULGU 4: shuffleBoard seker COKLU KUMESINI korur (seker uydurmaz/yutmaz)", () => {
  const g = createBoard();
  g[0][0] = { ...g[0][0], special: SPECIAL.COLOR_BOMB };
  g[5][5] = { ...g[5][5], special: SPECIAL.WRAPPED };
  const say = (b) => {
    const m = new Map();
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) {
        const k = `${b[c][r].type}:${b[c][r].special}`;
        m.set(k, (m.get(k) || 0) + 1);
      }
    return [...m.entries()].sort().map((e) => e.join("=")).join(",");
  };
  const s = shuffleBoard(g);
  assert.equal(say(s), say(g), "karistirma yalnizca YERLERI degistirmeli");
});

test("BULGU 5: handleShuffle karistirmadan SONRA cascade isletir (kaynak kapisi)", () => {
  // Bu test kural mantigini degil KABLOLAMAYI olcer: motor duzelse bile
  // GameScreen cagirmiyorsa ozellik OLU KAPI olur.
  const src = fs.readFileSync(path.join(KAYNAK, "screens", "GameScreen.js"), "utf8");
  const govde = src.slice(src.indexOf("function handleShuffle"));
  const kesit = govde.slice(0, govde.indexOf("function handleHammer"));
  assert.ok(
    /processCascade\(/.test(kesit),
    "handleShuffle processCascade CAGIRMALI (ONCE: sadece setGrid)",
  );
  assert.ok(
    /shuffleBoard\(/.test(kesit),
    "handleShuffle shuffleBoard kullanmali",
  );
});

test("EK: cekic OZEL sekere vurunca patlamasini TETIKLER (kaynak kapisi)", () => {
  // qa/qa_zincir.mjs bolum 3: cekicle cizgiliye vurulunca 1 hucre siliniyordu,
  // ayni seker eslesmeyle patlasa 9. 100 coin'lik cekic ozel sekeri harciyordu.
  const src = fs.readFileSync(path.join(KAYNAK, "screens", "GameScreen.js"), "utf8");
  const i = src.indexOf("if (hammerActive)");
  assert.ok(i > 0, "cekic dali bulunmali");
  const kesit = src.slice(i, i + 1600);
  assert.ok(
    /getSpecialRemovals\(grid,\s*matchedSet\)/.test(kesit),
    "cekic dali getSpecialRemovals CAGIRMALI (ONCE: tek hucre siliniyordu)",
  );
});

test("BULGU 1/3: GameScreen yeni motor kapilarini GERCEKTEN cagiriyor (kaynak kapisi)", () => {
  const src = fs.readFileSync(path.join(KAYNAK, "screens", "GameScreen.js"), "utf8");
  assert.ok(/reserveSpecials\(/.test(src), "reserveSpecials cagrilmali");
  assert.ok(/colorBombSwap\(/.test(src), "colorBombSwap cagrilmali");
  // placeSpecials artik cascade yolunda CAGRILMAMALI (olu kapiydi).
  const cagri = src.match(/^\s*collapsed = placeSpecials\(/m);
  assert.equal(cagri, null, "placeSpecials cascade yolunda hala cagriliyor");
});

/* ------------------------------------------------------------------ */
/* BULGU 2 — Color Frenzy tetikleyicisi                                */
/* ------------------------------------------------------------------ */

test("BULGU 2: SIFIR sarjda frenzy SUSAR — taze tahta artik tetikleyemez", () => {
  // ONCE: tetikleyici tahtadaki en kalabalik renkti. 81 hucre / 6 renk ->
  // guvercin yuvasi geregi en kalabalik renk HER ZAMAN >= 14 = FRENZY_THRESHOLD.
  // Olculdu: 2000 tahtanin 2000'i tetikliyordu, 300/300 oyun 3 yildizdi.
  assert.equal(frenzyReadyColor([0, 0, 0, 0, 0, 0]), -1);

  // Eski kirikligin BIREBIR kaniti: taze tahtanin renk sayimi hep esigi asar,
  // ama artik bu sayim tetikleyici DEGIL.
  for (let i = 0; i < 30; i++) {
    const g = createBoard();
    const say = [0, 0, 0, 0, 0, 0];
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) say[g[c][r].type]++;
    assert.ok(
      Math.max(...say) >= FRENZY_THRESHOLD,
      "kalibrasyon: eski esik zaten her tahtada asiliyor",
    );
    assert.equal(
      frenzyReadyColor([0, 0, 0, 0, 0, 0]),
      -1,
      "yeni tetikleyici tahtaya BAKMAZ",
    );
  }
});

test("BULGU 2: sarj hedefin ALTINDAyken susar, hedefte KONUSUR", () => {
  const altinda = new Array(6).fill(FRENZY_CHARGE_TARGET - 1);
  assert.equal(frenzyReadyColor(altinda), -1, "hedefin 1 altinda tetiklenmemeli");

  const tam = [0, 0, 0, 0, 0, 0];
  tam[3] = FRENZY_CHARGE_TARGET;
  assert.equal(frenzyReadyColor(tam), 3, "hedefte tetiklenmeli");
});

test("BULGU 2: hedef POZITIF olmali — 0 olursa mekanik yine her hamlede patlar", () => {
  assert.ok(
    FRENZY_CHARGE_TARGET > 0,
    "FRENZY_CHARGE_TARGET 0 ise sifir sarj bile tetikler",
  );
});

test("BULGU 2: esitlikte EN COK birikmis renk secilir (deterministik)", () => {
  const c = [0, 0, 0, 0, 0, 0];
  c[1] = FRENZY_CHARGE_TARGET + 5;
  c[4] = FRENZY_CHARGE_TARGET + 9;
  assert.equal(frenzyReadyColor(c), 4);
  const esit = [0, 0, 0, 0, 0, 0];
  esit[2] = FRENZY_CHARGE_TARGET;
  esit[5] = FRENZY_CHARGE_TARGET;
  assert.equal(frenzyReadyColor(esit), 2, "esitlikte ilk renk (deterministik)");
});

test("BULGU 2: GameScreen sarji TEMIZLENEN sekerden toplar ve tetikte SIFIRLAR (kaynak kapisi)", () => {
  const src = fs.readFileSync(path.join(KAYNAK, "screens", "GameScreen.js"), "utf8");
  assert.ok(/frenzyChargeRef/.test(src), "sarj sayaci olmali");
  assert.ok(
    /frenzyChargeRef\.current\[[^\]]+\]\s*\+=\s*1/.test(src),
    "temizlenen seker sarji artirmali",
  );
  assert.ok(
    /frenzyChargeRef\.current\s*=\s*\[0, 0, 0, 0, 0, 0\]/.test(src),
    "frenzy tetiklenince sarj SIFIRLANMALI",
  );
  assert.ok(
    /detectColorFrenzy\(currentGrid,\s*frenzyChargeRef\.current\)/.test(src),
    "frenzy tespiti sarji kullanmali (tahta sayimini degil)",
  );
});
