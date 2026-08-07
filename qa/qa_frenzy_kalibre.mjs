/**
 * FRENZY SARJ KALIBRASYONU (bulgu 2).
 *
 * Eski mekanik olculdu: 9x9/6 renk tahtada en kalabalik renk HER ZAMAN >= 14
 * oldugu icin frenzy her hamlede tetikleniyordu (probe3: 2000/2000).
 * Yeni mekanik sarj tabanli. Bu betik iki seyi olcer:
 *   1) KALIBRASYON — bilinen-iyi vakalar: sarj SIFIRken frenzy SUSMALI,
 *      sarj DOLUyken KONUSMALI. (Olcum bozuksa burada belli olur.)
 *   2) HIZ — hamle basina renk basina ne kadar sarj birikiyor; hangi hedef
 *      kac hamlede bir frenzy demek.
 */
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, reserveSpecials, hasValidMoves, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { FRENZY_CHARGE_TARGET, frenzyReadyColor } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

function detectColorFrenzy(grid, charge) {
  const t = frenzyReadyColor(charge);
  if (t < 0) return null;
  const cells = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const candy = grid[c]?.[r];
    if (candy && candy.special === SPECIAL.NONE && candy.type === t) cells.push({ col: c, row: r });
  }
  return cells.length ? { type: t, cells } : null;
}

console.log('FRENZY_CHARGE_TARGET =', FRENZY_CHARGE_TARGET);
console.log('=== 1. KALIBRASYON (bilinen-iyi vakalar) ===');
{
  const g = createBoard();
  const bos = detectColorFrenzy(g, [0, 0, 0, 0, 0, 0]);
  console.log('  taze tahta + SIFIR sarj  -> frenzy:', bos === null ? 'SUSTU  (dogru)' : 'KONUSTU (OLCUM BOZUK)');

  const altinda = new Array(6).fill(FRENZY_CHARGE_TARGET - 1);
  console.log('  sarj hedefin 1 ALTINDA   -> frenzy:', detectColorFrenzy(g, altinda) === null ? 'SUSTU  (dogru)' : 'KONUSTU (YANLIS)');

  const dolu = [0, 0, 0, 0, 0, 0];
  dolu[3] = FRENZY_CHARGE_TARGET;
  const f = detectColorFrenzy(g, dolu);
  console.log('  sarj TAM hedefte (renk 3)-> frenzy:', f ? `KONUSTU renk=${f.type} hucre=${f.cells.length} (dogru)` : 'SUSTU (YANLIS)');

  // ESKI mekanigin ayni vakada ne yaptigi: tahtayi say
  const say = [0, 0, 0, 0, 0, 0];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) say[g[c][r].type]++;
  console.log('  (ESKI mekanik ayni taze tahtada: en kalabalik renk =', Math.max(...say), '>= 14 -> her zaman tetiklerdi)');
}

console.log('\n=== 2. SARJ BIRIKME HIZI (frenzy KAPALI, saf hamle akisi) ===');
const N = Number(process.argv[2] || 40);
const MOVES = Number(process.argv[3] || 30);
let toplamHamle = 0;
const enBuyukSarjSerisi = [];
const hedefler = [30, 40, 50, 60, 70, 80, 90, 120];
const vurus = Object.fromEntries(hedefler.map((h) => [h, 0]));

for (let it = 0; it < N; it++) {
  let grid = createBoard();
  while (findMatches(grid).matched.size > 0) grid = createBoard();
  const charge = [0, 0, 0, 0, 0, 0];
  const ilkUlasma = Object.fromEntries(hedefler.map((h) => [h, -1]));

  for (let m = 0; m < MOVES; m++) {
    // en iyi takas
    let best = null, bv = -1;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 >= COLS || r2 >= ROWS) continue;
        const s = swapCells(grid, c, r, c2, r2);
        const { matched } = findMatches(s);
        if (matched.size === 0) continue;
        const v = matched.size + getSpecialRemovals(s, matched).size;
        if (v > bv) { bv = v; best = [c, r, c2, r2]; }
      }
    }
    if (!best) { grid = shuffleBoard(grid); continue; }
    grid = swapCells(grid, ...best);
    toplamHamle++;

    // cascade (frenzy KAPALI)
    let lvl = 0;
    for (;;) {
      const { matched, matchGroups } = findMatches(grid);
      if (matched.size === 0) break;
      const specials = determineSpecials(matchGroups);
      getSpecialRemovals(grid, matched).forEach((k) => matched.add(k));
      const res = specials.length ? reserveSpecials(grid, matched, specials) : { grid, matched };
      res.matched.forEach((key) => {
        const [c, r] = key.split(',').map(Number);
        const cell = grid[c]?.[r];
        if (cell && cell.type >= 0 && cell.type < 6) charge[cell.type]++;
      });
      grid = removeAndCollapse(res.grid, res.matched).grid;
      if (++lvl > 60) break;
    }
    const mx = Math.max(...charge);
    hedefler.forEach((h) => { if (ilkUlasma[h] < 0 && mx >= h) ilkUlasma[h] = m + 1; });
  }
  enBuyukSarjSerisi.push(Math.max(...charge));
  hedefler.forEach((h) => { if (ilkUlasma[h] > 0) vurus[h] += ilkUlasma[h]; });
  hedefler.forEach((h) => { if (ilkUlasma[h] < 0) vurus[h] += 0; });
  // ilk ulasma -1 ise "hic ulasilmadi" say
  hedefler.forEach((h) => { if (ilkUlasma[h] < 0) (vurus[h + '_yok'] = (vurus[h + '_yok'] || 0) + 1); });
}
enBuyukSarjSerisi.sort((a, b) => a - b);
console.log(`  ${N} oyun x ${MOVES} hamle -> ${MOVES} hamlede bir rengin ULASTIGI en yuksek sarj:`);
console.log('    min=%d  medyan=%d  max=%d  ortalama=%s',
  enBuyukSarjSerisi[0], enBuyukSarjSerisi[Math.floor(N / 2)], enBuyukSarjSerisi[N - 1],
  (enBuyukSarjSerisi.reduce((a, b) => a + b, 0) / N).toFixed(1));
console.log('  hedef | ilk frenzy ort. kacinci hamlede | hic ulasamayan oyun');
for (const h of hedefler) {
  const yok = vurus[h + '_yok'] || 0;
  const ulasan = N - yok;
  console.log('  %s | %s | %d/%d',
    String(h).padStart(5),
    ulasan ? (vurus[h] / ulasan).toFixed(1).padStart(6) : '     -',
    yok, N);
}
