// Yutulan ozel sekerler NEREDEN geliyor? (buyukluk sorgusu)
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE, CHAIN_BONUS_THRESHOLD }
  from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

let placeBasarili = 0, placeDenendi = 0;
function applyLuckyDrops(grid, fallMap) {
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
let yutulan = 0, yutulanKaynak = { luck: 0, chain: 0, match: 0 }, hamle = 0;
let tahtadaOzelToplam = 0, orneklem = 0;
const GAMES = Number(process.argv[2] || 60), MOVES = 25;
for (let gme = 0; gme < GAMES; gme++) {
  let grid = createBoard();
  let streak = 0;
  for (let mv = 0; mv < MOVES; mv++) {
    const moves = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      if (findMatches(swapCells(grid, c, r, c2, r2)).matched.size > 0) moves.push([c, r, c2, r2]);
    }
    if (moves.length === 0) { grid = shuffleBoard(grid); continue; }
    const [a, b, c2, r2] = moves[Math.floor(Math.random() * moves.length)];
    grid = swapCells(grid, a, b, c2, r2); hamle++;
    streak++;
    if (streak >= CHAIN_BONUS_THRESHOLD) {
      streak = 0;
      const cand = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.special === SPECIAL.NONE) cand.push([c, r]);
      if (cand.length) { const [pc, pr] = cand[Math.floor(Math.random() * cand.length)]; grid = grid.map(x => x.slice()); grid[pc][pr] = { ...grid[pc][pr], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V, kaynak: 'chain' }; }
    }
    for (;;) {
      const { matched, matchGroups } = findMatches(grid);
      if (matched.size === 0) break;
      let ozel = 0; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.special !== SPECIAL.NONE) ozel++;
      tahtadaOzelToplam += ozel; orneklem++;
      const extra = getSpecialRemovals(grid, matched);
      extra.forEach((k) => {
        if (matched.has(k)) return;
        const [c, r] = k.split(',').map(Number);
        const cell = grid[c]?.[r];
        if (cell && cell.special !== SPECIAL.NONE) { yutulan++; yutulanKaynak[cell.kaynak || 'luck']++; }
      });
      extra.forEach((k) => matched.add(k));
      const specials = determineSpecials(matchGroups);
      let { grid: col, fallMap } = removeAndCollapse(grid, matched);
      const before = col.flat().filter(x => x && x.special !== SPECIAL.NONE).length;
      col = applyLuckyDrops(col, fallMap);
      const mid = col.flat().filter(x => x && x.special !== SPECIAL.NONE).length;
      placeDenendi += specials.length;
      grid = placeSpecials(col, specials);
      const after = grid.flat().filter(x => x && x.special !== SPECIAL.NONE).length;
      placeBasarili += (after - mid);
      // kaynak etiketi koru
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const cc = grid[c][r]; if (cc && cc.special !== SPECIAL.NONE && !cc.kaynak) grid[c][r] = { ...cc, kaynak: 'luck' }; }
    }
  }
}
console.log(`${hamle} gecerli hamle`);
console.log(`determineSpecials URETTI: ${placeDenendi} ozel seker istegi`);
console.log(`placeSpecials TAHTAYA KOYABILDI: ${placeBasarili}  <-- eslesmeden ozel seker gercekten dogdu mu?`);
console.log(`cascade sirasinda tahtadaki ortalama ozel sayisi: ${(tahtadaOzelToplam / orneklem).toFixed(2)}`);
console.log(`YUTULAN ozel: ${yutulan}  kaynak dagilimi: ${JSON.stringify(yutulanKaynak)}`);
