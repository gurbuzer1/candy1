import {
  createBoard, findMatches, removeAndCollapse, shuffleBoard,
  swapCells, hasValidMoves, findHint, determineSpecials, calculateScore
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

// ---- helper: fully settle a board the way processCascade does ----
function settle(b) {
  let guard = 0;
  while (true) {
    const { matched } = findMatches(b);
    if (matched.size === 0) break;
    if (guard++ > 200) break;
    b = removeAndCollapse(b, matched).grid;
  }
  return b;
}

// ---- helper: play N real valid swaps so we get a REALISTIC mid-game board ----
function midGameBoard(swaps) {
  let b = settle(createBoard());
  for (let n = 0; n < swaps; n++) {
    const moves = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1 && findMatches(swapCells(b, c, r, c + 1, r)).matched.size > 0) moves.push([c, r, c + 1, r]);
      if (r < ROWS - 1 && findMatches(swapCells(b, c, r, c, r + 1)).matched.size > 0) moves.push([c, r, c, r + 1]);
    }
    if (!moves.length) break;
    const m = moves[Math.floor(Math.random() * moves.length)];
    b = settle(swapCells(b, ...m));
  }
  return b;
}

// A swap is GENUINELY legal iff a match group in the result contains one of
// the two swapped cells. (Standard match-3 rule.)
function swapIsGenuinelyLegal(board, c1, r1, c2, r2) {
  const t = swapCells(board, c1, r1, c2, r2);
  const { matchGroups } = findMatches(t);
  return matchGroups.some(g =>
    g.cells.some(x => (x.col === c1 && x.row === r1) || (x.col === c2 && x.row === r2))
  );
}
// What GameScreen.trySwap ACTUALLY checks (line 277):
function trySwapAccepts(board, c1, r1, c2, r2) {
  return findMatches(swapCells(board, c1, r1, c2, r2)).matched.size > 0;
}

const N = 500;
let leaves = 0, cellsTotal = 0;
let boardsWhereEverySwapAccepted = 0;
let illegalAccepted = 0, illegalTotal = 0;
let bogusHint = 0;
let phantomScoreTotal = 0, phantomScoreBoards = 0;

for (let i = 0; i < N; i++) {
  const before = midGameBoard(8);          // realistic mid-game, match-free
  if (findMatches(before).matched.size !== 0) throw new Error('pre-shuffle board not settled');

  const after = shuffleBoard(before);      // exactly what handleShuffle does (line 616)
  const { matched, matchGroups } = findMatches(after);

  if (matched.size === 0) continue;
  leaves++; cellsTotal += matched.size;

  // (1) phantom score: what the leftovers are worth when they finally blow
  const specials = determineSpecials(matchGroups);
  phantomScoreTotal += calculateScore(matchGroups, specials, 0);
  phantomScoreBoards++;

  // (2) illegal swaps accepted as legal
  let allAccepted = true, anyIllegal = false;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const pairs = [];
    if (c < COLS - 1) pairs.push([c, r, c + 1, r]);
    if (r < ROWS - 1) pairs.push([c, r, c, r + 1]);
    for (const p of pairs) {
      const legal = swapIsGenuinelyLegal(after, ...p);
      const accepted = trySwapAccepts(after, ...p);
      if (!accepted) allAccepted = false;
      if (!legal) { illegalTotal++; anyIllegal = true; if (accepted) illegalAccepted++; }
    }
  }
  if (allAccepted) boardsWhereEverySwapAccepted++;

  // (3) hint lies: findHint returns first cell regardless
  const h = findHint(after);
  if (h && h.col === 0 && h.row === 0 && !swapIsGenuinelyLegal(after, 0, 0, 1, 0) && !swapIsGenuinelyLegal(after, 0, 0, 0, 1)) bogusHint++;
}

console.log('--- realistic mid-game boards (8 real swaps + full cascade), N=' + N + ' ---');
console.log('shuffle leaves uncleared match :', leaves + '/' + N, '(' + (100 * leaves / N).toFixed(1) + '%)',
            ' avg cells:', (cellsTotal / leaves).toFixed(1));
console.log('phantom score sitting on board :', 'avg', Math.round(phantomScoreTotal / phantomScoreBoards), 'pts (base, cascade 0)');
console.log('ILLEGAL swaps accepted by trySwap:', illegalAccepted + '/' + illegalTotal,
            '(' + (100 * illegalAccepted / illegalTotal).toFixed(1) + '%)');
console.log('boards where EVERY swap accepted :', boardsWhereEverySwapAccepted + '/' + leaves,
            '(' + (100 * boardsWhereEverySwapAccepted / leaves).toFixed(1) + '%)');
console.log('bogus hint at (0,0)            :', bogusHint);
