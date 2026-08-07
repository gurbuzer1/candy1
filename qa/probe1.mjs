import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  calculateScore, hasValidMoves, findHint, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

let n = 0;
const mk = (fn) => {
  const g = [];
  for (let c = 0; c < COLS; c++) { g[c] = []; for (let r = 0; r < ROWS; r++) g[c][r] = { type: fn(c, r), special: SPECIAL.NONE, id: 'p' + (n++) }; }
  return g;
};
const base = (c, r) => (c + 2 * r) % 6;
const countSpecials = (g) => { let k = 0; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r] && g[c][r].special !== SPECIAL.NONE) k++; return k; };

console.log('=== A. 4-lu eslesme -> cizgili seker TAHTAYA KONUYOR MU? ===');
// yatay 4'lu: satir 4, sutun 2..5 => tip 0
let g = mk((c, r) => (r === 4 && c >= 2 && c <= 5) ? 0 : base(c, r));
let { matched, matchGroups } = findMatches(g);
console.log('matchGroups:', JSON.stringify(matchGroups.map(x => ({ len: x.cells.length, dir: x.direction, type: x.type }))));
const specials = determineSpecials(matchGroups);
console.log('determineSpecials ->', JSON.stringify(specials));
const extra = getSpecialRemovals(g, matched);
extra.forEach(k => matched.add(k));
let { grid: collapsed } = removeAndCollapse(g, matched);
console.log('collapse SONRASI null hucre sayisi:', collapsed.flat().filter(x => x === null).length);
const placed = placeSpecials(collapsed, specials);
console.log('placeSpecials SONRASI tahtadaki ozel seker sayisi:', countSpecials(placed));
console.log('  -> hedef hucre (col=%d,row=%d) special =', specials[0]?.col, specials[0]?.row, placed[specials[0].col][specials[0].row].special);
console.log('  BEKLENEN: 1 (cizgili). GORULEN:', countSpecials(placed));

console.log('\n=== A2. 5-li eslesme -> renk bombasi ===');
g = mk((c, r) => (r === 4 && c >= 2 && c <= 6) ? 0 : base(c, r));
let m2 = findMatches(g);
const sp2 = determineSpecials(m2.matchGroups);
console.log('grup uzunluklari:', m2.matchGroups.map(x => x.cells.length), '-> specials:', JSON.stringify(sp2));
let mset2 = m2.matched; getSpecialRemovals(g, mset2).forEach(k => mset2.add(k));
const col2 = removeAndCollapse(g, mset2).grid;
console.log('placeSpecials sonrasi ozel sayisi:', countSpecials(placeSpecials(col2, sp2)));

console.log('\n=== A3. L/T kesisimi -> sarmal ===');
// yatay 3 (r=4, c=2..4) + dikey 3 (c=4, r=4..6), hepsi tip 0
g = mk((c, r) => ((r === 4 && c >= 2 && c <= 4) || (c === 4 && r >= 4 && r <= 6)) ? 0 : base(c, r));
let m3 = findMatches(g);
const sp3 = determineSpecials(m3.matchGroups);
console.log('gruplar:', m3.matchGroups.map(x => x.direction + ':' + x.cells.length), '-> specials:', JSON.stringify(sp3));
let mset3 = m3.matched; getSpecialRemovals(g, mset3).forEach(k => mset3.add(k));
console.log('placeSpecials sonrasi ozel sayisi:', countSpecials(placeSpecials(removeAndCollapse(g, mset3).grid, sp3)));

console.log('\n=== B. findMatches kenar durumlari ===');
// 0. satirda yatay 3 (c=0..2)
g = mk((c, r) => (r === 0 && c <= 2) ? 0 : base(c, r));
console.log('satir 0, sutun 0-2 uclu -> bulundu mu:', findMatches(g).matchGroups.length > 0, findMatches(g).matchGroups.map(x => x.cells.length));
// son satir/sutun
g = mk((c, r) => (r === ROWS - 1 && c >= COLS - 3) ? 0 : base(c, r));
console.log('son satir, son 3 sutun -> ', findMatches(g).matchGroups.map(x => x.direction + ':' + x.cells.length));
// son sutunda dikey 3 (alt kose)
g = mk((c, r) => (c === COLS - 1 && r >= ROWS - 3) ? 0 : base(c, r));
console.log('son sutun, son 3 satir -> ', findMatches(g).matchGroups.map(x => x.direction + ':' + x.cells.length));
// IKILI sayilmamali
g = mk((c, r) => (r === 3 && c >= 2 && c <= 3) ? 0 : base(c, r));
console.log('ikili -> match sayisi (0 olmali):', findMatches(g).matched.size);
// tum tahta ayni renk
g = mk(() => 0);
const all = findMatches(g);
console.log('tum tahta tek renk -> matched:', all.matched.size, '(81 olmali), grup sayisi:', all.matchGroups.length, '(18 olmali)');

console.log('\n=== C. getSpecialRemovals zincirleme ===');
// c=4,r=4 STRIPED_H (satiri siler). Ayni satirda c=7,r=4 STRIPED_V var.
g = mk((c, r) => base(c, r));
g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'sh' };
g[7][4] = { type: 1, special: SPECIAL.STRIPED_V, id: 'sv' };
const mm = new Set(['4,4']);
const ex = getSpecialRemovals(g, mm);
const clearedCol7 = [...ex].filter(k => k.startsWith('7,')).length;
console.log('STRIPED_H patlatildi. Silinen hucre sayisi:', ex.size, '(satir=9 bekleniyor)');
console.log('Ayni satirdaki STRIPED_V (7,4) tetiklendi mi? sutun 7 den silinen:', clearedCol7, '(zincir olsaydi 9 olurdu)');
