// 75 coin'lik booster tahtayi IYILESTIRIYOR mu, KOTULESTIRIYOR mu?
// Ayni tahta, ayni hucre: (a) ozelsiz (b) COLOR_BOMB (c) STRIPED (kontrol).
// Olcu: gecerli hamle sayisi.
import { createBoard, swapCells, findMatches } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

function hamleSay(g) {
  let n = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (c < COLS - 1 && findMatches(swapCells(g, c, r, c + 1, r)).matched.size > 0) n++;
    if (r < ROWS - 1 && findMatches(swapCells(g, c, r, c, r + 1)).matched.size > 0) n++;
  }
  return n;
}
const N = Number(process.argv[2] || 400);
let dz = 0, db = 0, ds = 0, kotulesen = 0, iyilesen = 0;
for (let i = 0; i < N; i++) {
  let g = createBoard();
  while (findMatches(g).matched.size > 0) g = createBoard();
  const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
  const gb = g.map((x) => x.slice()); gb[c][r] = { ...gb[c][r], special: SPECIAL.COLOR_BOMB };
  const gs = g.map((x) => x.slice()); gs[c][r] = { ...gs[c][r], special: SPECIAL.STRIPED_H };
  const a = hamleSay(g), b = hamleSay(gb), s = hamleSay(gs);
  dz += a; db += b; ds += s;
  if (b < a) kotulesen++; else if (b > a) iyilesen++;
}
console.log('%d tahta — ortalama GECERLI HAMLE sayisi:', N);
console.log('  ozelsiz (booster ALINMADI) : %s', (dz / N).toFixed(2));
console.log('  COLOR_BOMB (75 coin)       : %s   <-- fark %s', (db / N).toFixed(2), ((db - dz) / N).toFixed(2));
console.log('  STRIPED (75 coin, KONTROL) : %s   <-- fark %s', (ds / N).toFixed(2), ((ds - dz) / N).toFixed(2));
console.log('  bombayla hamle sayisi AZALAN tahta: %d/%d | ARTAN: %d', kotulesen, N, iyilesen);
