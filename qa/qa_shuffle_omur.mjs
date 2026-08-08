// Bozuk durum KAC takas suruyor? processCascade dongusunu birebir taklit et.
const R = 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/';
const { createBoard, swapCells, findMatches, determineSpecials, getSpecialRemovals,
        removeAndCollapse, placeSpecials, shuffleBoard } = await import(R + 'engine/BoardEngine.js');
const { COLS, ROWS } = await import(R + 'constants/kural.js');
const key = (c, r) => `${c},${r}`;

// GameScreen.processCascade'in tahta kismi (animasyon/puan haric)
function cascade(g) {
  let cur = g, lvl = 0;
  while (lvl < 60) {
    const { matched, matchGroups } = findMatches(cur);
    if (matched.size === 0) return { grid: cur, lvl };
    const specials = determineSpecials(matchGroups);
    getSpecialRemovals(cur, matched).forEach(k => matched.add(k));
    let { grid: col } = removeAndCollapse(cur, matched);
    cur = placeSpecials(col, specials);
    lvl++;
  }
  return { grid: cur, lvl };
}

let N = 400, olu1 = 0, olu2 = 0, hazir1 = 0, hazir2 = 0;
for (let i = 0; i < N; i++) {
  let g = shuffleBoard(createBoard());
  if (findMatches(g).matched.size > 0) hazir1++;
  // Oyuncu YERELDE OLU bir takas yapiyor (kasten hicbir sey uretmeyen)
  let yapildi = false;
  for (let c = 0; c < COLS && !yapildi; c++) for (let r = 0; r < ROWS && !yapildi; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr; if (c2 >= COLS || r2 >= ROWS) continue;
      const sw = swapCells(g, c, r, c2, r2);
      const m = findMatches(sw).matched;
      if (m.size > 0 && !m.has(key(c, r)) && !m.has(key(c2, r2))) {
        olu1++;                       // 1. takas: OLU ama KABUL edildi
        g = cascade(sw).grid;         // trySwap -> processCascade
        yapildi = true; break;
      }
    }
  }
  if (!yapildi) continue;
  // 2. takas: tahta hala hazir eslesme tasiyor mu?
  if (findMatches(g).matched.size > 0) hazir2++;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr; if (c2 >= COLS || r2 >= ROWS) continue;
      const m = findMatches(swapCells(g, c, r, c2, r2)).matched;
      if (m.size > 0 && !m.has(key(c, r)) && !m.has(key(c2, r2))) { olu2++; }
    }
  }
}
console.log('karistirmadan SONRA hazir eslesmeli tahta      : %d/%d', hazir1, N);
console.log('1. takas OLU ama KABUL edildi                  : %d/%d', olu1, N);
console.log('o takasin cascade\'i bittikten SONRA hala hazir eslesmeli tahta: %d/%d', hazir2, N);
console.log('2. takasta hala kabul edilebilir OLU takas sayisi (toplam)     : %d', olu2);
console.log('=> bozuk durumun omru: %s takas', hazir2 === 0 ? 'TEK (kendi kendini toparliyor)' : 'BIRDEN FAZLA');
