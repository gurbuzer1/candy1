// Zincirleme patlama: patlamanin ICINE dusen ama KENDISI patlamayan ozel seker
// sayisini gercek oyun akisinda olcer (GameScreen processCascade birebir).
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials, calculateScore,
  hasValidMoves, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

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
let sessizOzel = 0, patlama = 0, hamle = 0;
const GAMES = Number(process.argv[2] || 20), MOVES = 20;
for (let gme = 0; gme < GAMES; gme++) {
  let grid = createBoard();
  for (let mv = 0; mv < MOVES; mv++) {
    // ilk gecerli takasi bul
    let done = false;
    for (let c = 0; c < COLS && !done; c++) for (let r = 0; r < ROWS && !done; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 >= COLS || r2 >= ROWS) continue;
        const s = swapCells(grid, c, r, c2, r2);
        if (findMatches(s).matched.size > 0) { grid = s; done = true; break; }
      }
    }
    if (!done) { grid = shuffleBoard(grid); continue; }
    hamle++;
    // cascade
    for (;;) {
      const { matched, matchGroups } = findMatches(grid);
      if (matched.size === 0) break;
      const extra = getSpecialRemovals(grid, matched);
      // extra icinde olup matched'da OLMAYAN ozel seker = tetiklenmeden silinen
      extra.forEach((k) => {
        if (matched.has(k)) return;
        const [c, r] = k.split(',').map(Number);
        const cell = grid[c]?.[r];
        if (cell && cell.special !== SPECIAL.NONE) sessizOzel++;
      });
      if (extra.size > 0) patlama++;
      extra.forEach((k) => matched.add(k));
      let { grid: col, fallMap } = removeAndCollapse(grid, matched);
      grid = placeSpecials(applyLuckyDrops(col, fallMap), determineSpecials(matchGroups));
    }
  }
}
console.log('%d oyun x %d hamle (%d gecerli hamle):', GAMES, MOVES, hamle);
console.log('  ozel seker patlamasi sayisi: %d', patlama);
console.log('  patlamanin icinde kalip KENDISI patlamayan ozel seker: %d (hamle basina %s)',
  sessizOzel, (sessizOzel / hamle).toFixed(3));
