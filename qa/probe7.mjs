// COLOR_BOMB (75 coin'lik "Color Bomb" pre-game booster + HowToPlay vaadi)
// hic patlayabiliyor mu?
// findMatches, COLOR_BOMB'u her diziden DISLIYOR (BoardEngine.js:58 ve :84),
// dolayisiyla bomba hucresi hicbir zaman `matched` icine giremez; getSpecialRemovals
// icindeki COLOR_BOMB dali (BoardEngine.js:187) da bu yuzden hic calismaz.
import { createBoard, swapCells, findMatches, getSpecialRemovals } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

const N = Number(process.argv[2] || 300);
let bombaEslesti = 0, takasDenendi = 0, cizgiliEslesti = 0;
for (let i = 0; i < N; i++) {
  const g = createBoard();
  const bc = Math.floor(Math.random() * COLS), br = Math.floor(Math.random() * ROWS);
  g[bc][br] = { ...g[bc][br], special: SPECIAL.COLOR_BOMB };
  // kontrol grubu: baska bir hucreye CIZGILI koy
  let sc, sr;
  do { sc = Math.floor(Math.random() * COLS); sr = Math.floor(Math.random() * ROWS); } while (sc === bc && sr === br);
  g[sc][sr] = { ...g[sc][sr], special: SPECIAL.STRIPED_H };

  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      const s = swapCells(g, c, r, c2, r2);
      const { matched } = findMatches(s);
      if (matched.size === 0) continue;
      takasDenendi++;
      // bomba takas sonrasi nerede?
      let nbc = bc, nbr = br;
      if (bc === c && br === r) { nbc = c2; nbr = r2; } else if (bc === c2 && br === r2) { nbc = c; nbr = r; }
      if (matched.has(`${nbc},${nbr}`)) bombaEslesti++;
      let nsc = sc, nsr = sr;
      if (sc === c && sr === r) { nsc = c2; nsr = r2; } else if (sc === c2 && sr === r2) { nsc = c; nsr = r; }
      if (matched.has(`${nsc},${nsr}`)) cizgiliEslesti++;
    }
  }
}
console.log('%d tahta x tum komsu takaslar -> eslesme ureten %d takas incelendi', N, takasDenendi);
console.log('  COLOR_BOMB hucresi `matched` icine girdi mi (= patladi mi): %d kez', bombaEslesti);
console.log('  KONTROL — CIZGILI hucresi `matched` icine girdi mi:         %d kez', cizgiliEslesti);
console.log('  (kontrol > 0 ise olcum saglam; bomba = 0 ise bomba ASLA patlamiyor)');
