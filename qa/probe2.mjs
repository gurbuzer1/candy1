import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  calculateScore, hasValidMoves, findHint, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL, SCORE_VALUES } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

const N = Number(process.argv[2] || 500);

console.log('=== D. shuffleBoard: %d tekrar ===', N);
let leftMatch = 0, noMoves = 0, matchCells = 0, dupIds = 0, lost = 0;
for (let i = 0; i < N; i++) {
  const g = createBoard();
  const s = shuffleBoard(g);
  const m = findMatches(s).matched.size;
  if (m > 0) { leftMatch++; matchCells += m; }
  if (!hasValidMoves(s)) noMoves++;
  const ids = new Set(); let d = 0; let cnt = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const x = s[c][r]; if (!x) continue; cnt++; if (ids.has(x.id)) d++; ids.add(x.id); }
  if (d > 0) dupIds++;
  if (cnt !== COLS * ROWS) lost++;
}
console.log('  karistirma SONRASI hazir eslesme birakan tahta: %d/%d (%s%%)', leftMatch, N, (100 * leftMatch / N).toFixed(1));
console.log('  ortalama bedava eslesen hucre (eslesme olanlarda): %s', (matchCells / Math.max(1, leftMatch)).toFixed(1));
console.log('  karistirma SONRASI gecerli hamlesi OLMAYAN tahta: %d/%d (%s%%)', noMoves, N, (100 * noMoves / N).toFixed(2));
console.log('  tekrar eden id / eksik hucre: %d / %d', dupIds, lost);

console.log('\n=== E. createBoard: baslangicta eslesme + gecerli hamle (%d tekrar) ===', N);
let cbMatch = 0, cbNoMove = 0;
for (let i = 0; i < N; i++) {
  const g = createBoard();
  if (findMatches(g).matched.size > 0) cbMatch++;
  if (!hasValidMoves(g)) cbNoMove++;
}
console.log('  eslesmeli dogan tahta: %d/%d, gecerli hamlesiz dogan tahta: %d/%d', cbMatch, N, cbNoMove, N);

console.log('\n=== F. hasValidMoves <-> findHint CELISKI taramasi (%d rastgele tahta) ===', N * 4);
let celiski = 0, hintBad = 0;
for (let i = 0; i < N * 4; i++) {
  const g = createBoard();
  const hv = hasValidMoves(g);
  const h = findHint(g);
  if (hv !== (h !== null)) celiski++;
  if (h) {
    // ipucu gercekten gecerli mi? saga VEYA asagi takasla eslesme uretmeli
    const a = swapCells(g, h.col, h.row, Math.min(h.col + 1, COLS - 1), h.row);
    const b = swapCells(g, h.col, h.row, h.col, Math.min(h.row + 1, ROWS - 1));
    if (findMatches(a).matched.size === 0 && findMatches(b).matched.size === 0) hintBad++;
  }
}
console.log('  hasValidMoves != (findHint!=null) celiskisi: %d', celiski);
console.log('  gecersiz ipucu: %d', hintBad);

console.log('\n=== G. calculateScore saglik ===');
const g4 = [{ cells: [1, 2, 3, 4].map((x) => ({ col: x, row: 0 })), type: 0, direction: 'horizontal' }];
console.log('  3-lu, cascade0:', calculateScore([{ cells: [1, 2, 3].map(x => ({ col: x, row: 0 })) }], [], 0));
console.log('  4-lu, cascade0:', calculateScore(g4, [], 0));
console.log('  4-lu + cizgili ozel, cascade0:', calculateScore(g4, [{ special: SPECIAL.STRIPED_V }], 0));
console.log('  3-lu, cascade5:', calculateScore([{ cells: [1, 2, 3].map(x => ({ col: x, row: 0 })) }], [], 5));
console.log('  cascadeLevel undefined:', calculateScore([{ cells: [1, 2, 3].map(x => ({ col: x, row: 0 })) }], [], undefined));
console.log('  bos girdi:', calculateScore([], [], 0));
console.log('  cascade 100:', calculateScore([{ cells: [1, 2, 3].map(x => ({ col: x, row: 0 })) }], [], 100));

console.log('\n=== H. removeAndCollapse butunluk (%d tekrar) ===', N);
let holes = 0, dup = 0, badFall = 0;
for (let i = 0; i < N; i++) {
  const g = createBoard();
  const m = new Set();
  for (let k = 0; k < 12; k++) m.add(`${Math.floor(Math.random() * COLS)},${Math.floor(Math.random() * ROWS)}`);
  const { grid: out, fallMap } = removeAndCollapse(g, m);
  const ids = new Set();
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const x = out[c][r];
    if (!x) { holes++; continue; }
    if (ids.has(x.id)) dup++;
    ids.add(x.id);
  }
  fallMap.forEach(f => { if (f.isNew && f.fromRow >= 0) badFall++; });
}
console.log('  bosluk: %d, tekrar id: %d, yeni sekerin fromRow>=0 (tahta icinden dusuyor gibi): %d', holes, dup, badFall);
