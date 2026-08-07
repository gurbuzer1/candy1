import { createBoard, removeAndCollapse, findMatches } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { FRENZY_THRESHOLD } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

function counts(grid) {
  const k = [0, 0, 0, 0, 0, 0];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const x = grid[c]?.[r];
    if (x && x.special === SPECIAL.NONE && x.type >= 0 && x.type < 6) k[x.type]++;
  }
  return k;
}
const N = Number(process.argv[2] || 2000);
let fires = 0, maxSum = 0;
for (let i = 0; i < N; i++) {
  const g = createBoard();
  const k = counts(g);
  const mx = Math.max(...k);
  maxSum += mx;
  if (mx >= FRENZY_THRESHOLD) fires++;
}
console.log('FRENZY_THRESHOLD =', FRENZY_THRESHOLD, ' | 9x9=81 hucre, 6 renk -> beklenen renk basina 13.5');
console.log('createBoard ile uretilen %d tahtanin %d tanesinde (%s%%) bir renk >= %d, yani Color Frenzy SADECE ZAR ile tetikleniyor',
  N, fires, (100 * fires / N).toFixed(1), FRENZY_THRESHOLD);
console.log('ortalama en kalabalik renk sayisi: %s', (maxSum / N).toFixed(2));
