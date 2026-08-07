// OLCUM KALIBRASYONU: "%100 vuran bulgu bozuk olcum olabilir" dersine karsi.
// detectColorFrenzy'nin BIRE BIR kopyasi ile hem TETIKLENEN hem TETIKLENMEYEN
// bilinen-iyi vaka uretiliyor.
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { FRENZY_THRESHOLD } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

function detectColorFrenzy(grid) { // GameScreen.js:55 birebir
  const cells = [[], [], [], [], [], []];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const candy = grid[c]?.[r];
    if (candy && candy.special === SPECIAL.NONE && candy.type >= 0 && candy.type < 6) cells[candy.type].push({ col: c, row: r });
  }
  for (let t = 0; t < 6; t++) if (cells[t].length >= FRENZY_THRESHOLD) return { type: t, cells: cells[t] };
  return null;
}
// mumkun olan EN DENGELI dagilim: 81 = 14+14+14+13+13+13
function balanced(plan = [14, 14, 14, 13, 13, 13], specialCount = 0) {
  const seq = [];
  plan.forEach((n, t) => { for (let i = 0; i < n; i++) seq.push(t); });
  while (seq.length < COLS * ROWS) seq.push(-1); // -1 = ozel (duz sayilmaz)
  const g = [];
  let i = 0;
  for (let c = 0; c < COLS; c++) {
    g[c] = [];
    for (let r = 0; r < ROWS; r++) {
      const t = seq[i++];
      g[c][r] = t === -1
        ? { type: 0, special: SPECIAL.STRIPED_H, id: 'x' + i }
        : { type: t, special: SPECIAL.NONE, id: 'x' + i };
    }
  }
  return g;
}
console.log('81 hucre / 6 renk -> guvercin yuvasi: en kalabalik renk HER ZAMAN >= ceil(81/6) = 14 = FRENZY_THRESHOLD');
console.log('  EN DENGELI tahta (14/14/14/13/13/13), 0 ozel -> frenzy:',
  detectColorFrenzy(balanced([14, 14, 14, 13, 13, 13])) ? 'TETIKLENDI' : 'yok');
console.log('  KALIBRASYON (bilinen-iyi): 13/13/13/13/13/13 + 3 ozel -> frenzy:',
  detectColorFrenzy(balanced([13, 13, 13, 13, 13, 13])) ? 'TETIKLENDI' : 'yok',
  ' <-- burada SUSMASI gerekiyordu; olcum saglam');
