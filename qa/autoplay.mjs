/* eslint-disable */
/*
 * ############################################################################
 * ##                                                                        ##
 * ##   ⛔ BU ARAC BOZUK BIR OLCUM ARACIDIR — SAYILARINA INANMA. ⛔          ##
 * ##   YERINE `qa/autoplay2.mjs` KULLAN.                                    ##
 * ##                                                                        ##
 * ############################################################################
 *
 * SILINMEDI — bu dosya ESKI (kirik) motorun davranisinin kaydidir; hangi
 * bulgunun hangi sayilardan cikarildigini kanitlamak icin duruyor. Ama ARTIK
 * URUNUN AKISINI TAKLIT ETMIYOR: uc duzeltme yapildi, bu dosya UCUNU DE
 * kacirdi. Dolayisiyla urun degil, 2026-08-07 sabahindaki kirik hali olculuyor.
 *
 * ============================================================================
 * NEDEN BOZUK (uc sapma, hepsi hala bu dosyanin icinde)
 * ============================================================================
 * 1) ESKI FRENZY TETIKLEYICISI. Asagidaki `detectColorFrenzy(grid)` tahtadaki
 *    en kalabalik rengi sayip `FRENZY_THRESHOLD` (=14) ile karsilastirir.
 *    9x9 = 81 hucre / 6 renk -> guvercin yuvasi geregi en kalabalik renk HER
 *    ZAMAN >= 14, yani frenzy HER HAMLEDE patlar. Urun bunu 2026-08-07'de
 *    birakti; artik tetikleyici `frenzyReadyColor(charge)` (oyuncunun
 *    biriktirdigi sarj). Bu dosya sarji hic bilmez.
 * 2) OLU `placeSpecials`. Ozel sekerler collapse'TAN SONRA konmaya calisilir,
 *    kosul (`=== null`) hicbir zaman saglanmaz -> eslesmeden ozel seker DOGMAZ.
 *    Urun artik `reserveSpecials` ile collapse'TAN ONCE yerine yaziyor.
 * 3) TAKASLA RENK BOMBASI AKTIVASYONU YOK (`colorBombSwap` hic cagrilmiyor).
 *
 * ============================================================================
 * URETTIGI YANLIS SAYILAR — 2026-08-07 aksami OLCULDU (20 oyun/seviye)
 * ============================================================================
 *   node qa/autoplay.mjs 20 1,10,20,25,26,30
 *     sev  1 : ort 137.318 | %>=t1 100% %>=t2 100% %>=t3 100% | frenzy/oyun 20,0
 *     sev 10 : ort 150.864 | 100% / 100% / 100%               | frenzy/oyun 21,9
 *     sev 20 : ort 191.192 | 100% / 100% / 100%               | frenzy/oyun 27,9
 *     sev 25 : ort 220.192 | 100% / 100% / 100%               | frenzy/oyun 31,9
 *     sev 26 : ort 247.844 | 100% / 100% / 100%               | frenzy/oyun 35,8
 *     sev 30 : ort 245.924 | 100% / 100% / 100%               | frenzy/oyun 36,0
 *   -> 30 seviyenin HEPSINDE %100. "frenzy/oyun" hamle sayisina ESIT: her
 *      hamlede patliyor. "eslesmeden konan ozel" sutunu her seviyede 0.
 *
 *   NOFRENZY=1 node qa/autoplay.mjs 20 1,15,25,30
 *     sev  1 : ort  6.596 | %>=t1  45% | frenzy/oyun 0,0
 *     sev 15 : ort  7.392 | %>=t1   0%
 *     sev 25 : ort  9.403 | %>=t1   0%
 *     sev 30 : ort 10.981 | %>=t1   0%
 *   -> Ayni arac, tek anahtar farkiyla %100'den %0'a duser. Bir olcum araci
 *      boyle davraniyorsa OLCTUGU SEY OYUN DEGILDIR.
 *
 * Karsilastirma — DOGRU arac (`node qa/autoplay2.mjs 400 1,25,26,30`):
 *     sev 1 %97 · sev 25 %53 · sev 26 %50 · sev 30 %44,
 *     frenzy/oyun 1,7-3,9 · eslesmeden konan ozel/oyun 9,9-18,6.
 *
 * ============================================================================
 * NE YAPMALI
 * ============================================================================
 *   node qa/autoplay2.mjs <oyun_sayisi> <seviyeler>     (SEED=<n> ile tohumlu)
 *   node qa/monotonluk_dogrula.mjs [n] [tohumlar]       (zorluk egrisi)
 * Bu dosyayi HICBIR yonde (ne "gecti" ne "kaldi") kanit olarak kullanma.
 */
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  calculateScore, hasValidMoves, shuffleBoard,
} from '../src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from '../src/constants/kural.js';
import { LEVELS } from '../src/constants/levels.js';
import {
  FRENZY_THRESHOLD, LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE, CHAIN_BONUS_THRESHOLD,
} from '../src/constants/economy.js';

// Calistirilinca da uyarsin: yorumu okumayan biri ciktida gorsun.
console.error('⛔ UYARI: qa/autoplay.mjs BOZUK bir olcum aracidir (eski frenzy + olu placeSpecials).');
console.error('   Tum seviyelerde %100, NOFRENZY=1 ile %0 uretir. Dogru arac: qa/autoplay2.mjs');

function detectColorFrenzy(grid) {
  const cells = [[], [], [], [], [], []];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const candy = grid[c]?.[r];
    if (candy && candy.special === SPECIAL.NONE && candy.type >= 0 && candy.type < 6) cells[candy.type].push({ col: c, row: r });
  }
  for (let t = 0; t < 6; t++) if (cells[t].length >= FRENZY_THRESHOLD) return { type: t, cells: cells[t] };
  return null;
}
function applyLuckyDrops(grid, fallMap) {
  if (!fallMap) return grid;
  const out = grid.map((c) => c.slice());
  fallMap.forEach((e) => {
    if (!e.isNew) return;
    const cell = out[e.col]?.[e.toRow];
    if (!cell || cell.special !== SPECIAL.NONE) return;
    const roll = Math.random();
    if (roll < LUCKY_WRAPPED_CHANCE) out[e.col][e.toRow] = { ...cell, special: SPECIAL.WRAPPED };
    else if (roll < LUCKY_WRAPPED_CHANCE + LUCKY_STRIPED_CHANCE) out[e.col][e.toRow] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
  });
  return out;
}

function playLevel(levelIdx, opts = {}) {
  const lv = LEVELS[levelIdx];
  let grid = createBoard();
  let safety = 0;
  while (findMatches(grid).matched.size > 0 && safety < 100) { grid = createBoard(); safety++; }
  let score = 0, moves = lv.moves, chainStreak = 0;
  let frenzyFired = false;
  let specialsPlaced = 0, frenzyCount = 0, maxCascade = 0;

  function processCascade(g, level) {
    let cur = g, lvl = level;
    for (;;) {
      const { matched, matchGroups } = findMatches(cur);
      if (matched.size === 0) {
        if (!frenzyFired && !process.env.NOFRENZY) {
          const f = detectColorFrenzy(cur);
          if (f) { frenzyFired = true; frenzyCount++; cur = triggerFrenzy(cur, f); lvl = 0; continue; }
        }
        if (!hasValidMoves(cur)) { cur = shuffleBoard(cur); return cur; }
        return cur;
      }
      if (lvl > maxCascade) maxCascade = lvl;
      const specials = determineSpecials(matchGroups);
      const extra = getSpecialRemovals(cur, matched);
      extra.forEach((k) => matched.add(k));
      score += calculateScore(matchGroups, specials, lvl);
      let { grid: collapsed, fallMap } = removeAndCollapse(cur, matched);
      collapsed = applyLuckyDrops(collapsed, fallMap);
      if (specials.length > 0) {
        const before = countSpecials(collapsed);
        collapsed = placeSpecials(collapsed, specials);
        specialsPlaced += countSpecials(collapsed) - before;
      }
      cur = collapsed; lvl++;
    }
  }

  function triggerFrenzy(g, frenzy) {
    const converted = g.map((c) => c.slice());
    frenzy.cells.forEach(({ col, row }) => {
      const cell = converted[col][row];
      if (cell) converted[col][row] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
    });
    score += frenzy.cells.length * 80;
    const fm = new Set(frenzy.cells.map(({ col, row }) => `${col},${row}`));
    getSpecialRemovals(converted, fm).forEach((k) => fm.add(k));
    score += fm.size * 60;
    let { grid: collapsed2, fallMap: f2 } = removeAndCollapse(converted, fm);
    return applyLuckyDrops(collapsed2, f2);
  }

  function countSpecials(g) { let k = 0; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r] && g[c][r].special !== SPECIAL.NONE) k++; return k; }

  function bestSwap(g) {
    let best = null, bestScore = -1;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 >= COLS || r2 >= ROWS) continue;
        const s = swapCells(g, c, r, c2, r2);
        const { matched, matchGroups } = findMatches(s);
        if (matched.size === 0) continue;
        const sp = determineSpecials(matchGroups);
        const ex = getSpecialRemovals(s, matched);
        const v = matched.size + ex.size + sp.length * 5;
        if (v > bestScore) { bestScore = v; best = [c, r, c2, r2]; }
      }
    }
    return best;
  }

  while (moves > 0) {
    const mv = bestSwap(grid);
    if (!mv) { grid = shuffleBoard(grid); continue; }
    frenzyFired = false;
    grid = swapCells(grid, ...mv);
    moves--;
    chainStreak++;
    if (chainStreak >= CHAIN_BONUS_THRESHOLD) {
      chainStreak = 0;
      const cands = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.special === SPECIAL.NONE) cands.push({ c, r });
      if (cands.length) {
        const p = cands[Math.floor(Math.random() * cands.length)];
        grid = grid.map((c) => c.slice());
        grid[p.c][p.r] = { ...grid[p.c][p.r], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V, id: 'chain' + Math.random() };
      }
    }
    grid = processCascade(grid, 0);
  }
  return { score, specialsPlaced, frenzyCount, maxCascade };
}

const RUNS = Number(process.argv[2] || 30);
const which = process.argv[3] ? process.argv[3].split(',').map(Number) : [1, 2, 5, 10, 15, 20, 25, 30];
console.log('seviye | hamle | t1 / t2 / t3 | ort.skor | min-max | %>=t1 | %>=t2 | %>=t3 | frenzy/oyun | eslesmeden konan ozel');
for (const num of which) {
  const idx = num - 1;
  const lv = LEVELS[idx];
  const res = [];
  for (let i = 0; i < RUNS; i++) res.push(playLevel(idx));
  const sc = res.map(r => r.score).sort((a, b) => a - b);
  const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
  const pct = (t) => (100 * sc.filter(s => s >= t).length / sc.length).toFixed(0);
  const fr = (res.reduce((a, b) => a + b.frenzyCount, 0) / RUNS).toFixed(1);
  const spp = res.reduce((a, b) => a + b.specialsPlaced, 0);
  console.log('%s | %s | %s / %s / %s | %s | %s-%s | %s%% | %s%% | %s%% | %s | %d',
    String(num).padStart(2), String(lv.moves).padStart(2), lv.target1, lv.target2, lv.target3,
    String(Math.round(avg)).padStart(7), sc[0], sc[sc.length - 1],
    pct(lv.target1).padStart(3), pct(lv.target2).padStart(3), pct(lv.target3).padStart(3), fr, spp);
}
