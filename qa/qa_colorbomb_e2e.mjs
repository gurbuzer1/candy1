// BAGIMSIZ DOGRULAMA — probe7'ye guvenmiyorum, tam oyun dongusunu yeniden kuruyorum.
// GameScreen.processCascade / trySwap / triggerChainBonus / applyLuckyDrops /
// triggerColorFrenzy / handleCellTap(hammer) mantiginin SAF (React'siz) kopyasi.
// Olculen: bir COLOR_BOMB hucresi getSpecialRemovals'a giden `matched` kumesine
// GIRIYOR MU (= patlama dali calisiyor mu)?
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  hasValidMoves, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

const LUCKY_STRIPED_CHANCE = 0.04;
const LUCKY_WRAPPED_CHANCE = 0.015;
const CHAIN_BONUS_THRESHOLD = 5;
const FRENZY_THRESHOLD = 14;

const S = {
  bombPatladi: 0,        // COLOR_BOMB, getSpecialRemovals'a giden matched icinde
  bombSessizSilindi: 0,  // COLOR_BOMB, nihai matched icinde (yani tahtadan silindi) ama patlamadi
  cizgiliPatladi: 0,     // KONTROL GRUBU
  sarmalPatladi: 0,      // KONTROL GRUBU 2
  bombVarOlanKare: 0,    // determineSpecials'in urettigi COLOR_BOMB sayisi
  hamle: 0, cascade: 0, frenzy: 0, cekic: 0, karistirma: 0,
};

function say(grid, matched, sayacOnEk) {
  matched.forEach((k) => {
    const [c, r] = k.split(',').map(Number);
    const cell = grid[c]?.[r];
    if (!cell) return;
    if (cell.special === SPECIAL.COLOR_BOMB) S[sayacOnEk] += 1;
  });
}

function applyLuckyDrops(grid, fallMap) {
  const out = grid.map((c) => c.slice());
  fallMap.forEach((entry) => {
    if (!entry.isNew) return;
    const cell = out[entry.col]?.[entry.toRow];
    if (!cell || cell.special !== SPECIAL.NONE) return;
    const roll = Math.random();
    if (roll < LUCKY_WRAPPED_CHANCE) {
      out[entry.col][entry.toRow] = { ...cell, special: SPECIAL.WRAPPED };
    } else if (roll < LUCKY_WRAPPED_CHANCE + LUCKY_STRIPED_CHANCE) {
      const dir = Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V;
      out[entry.col][entry.toRow] = { ...cell, special: dir };
    }
  });
  return out;
}

function detectColorFrenzy(grid) {
  const cells = [[], [], [], [], [], []];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const candy = grid[c]?.[r];
    if (candy && candy.special === SPECIAL.NONE && candy.type >= 0 && candy.type < 6) {
      cells[candy.type].push({ col: c, row: r });
    }
  }
  for (let t = 0; t < 6; t++) if (cells[t].length >= FRENZY_THRESHOLD) return { type: t, cells: cells[t] };
  return null;
}

let frenzyFired = false;

function processCascade(currentGrid, cascadeLevel) {
  const { matched, matchGroups } = findMatches(currentGrid);

  if (matched.size === 0) {
    if (!frenzyFired) {
      const frenzy = detectColorFrenzy(currentGrid);
      if (frenzy) { frenzyFired = true; return triggerColorFrenzy(currentGrid, frenzy); }
    }
    if (!hasValidMoves(currentGrid)) { S.karistirma++; return shuffleBoard(currentGrid); }
    return currentGrid;
  }
  S.cascade++;

  const specials = determineSpecials(matchGroups);
  specials.forEach((s) => { if (s.special === SPECIAL.COLOR_BOMB) S.bombVarOlanKare++; });

  // === OLCUM NOKTASI: getSpecialRemovals'a giren `matched` ===
  say(currentGrid, matched, 'bombPatladi');
  matched.forEach((k) => {
    const [c, r] = k.split(',').map(Number);
    const cell = currentGrid[c]?.[r];
    if (!cell) return;
    if (cell.special === SPECIAL.STRIPED_H || cell.special === SPECIAL.STRIPED_V) S.cizgiliPatladi++;
    if (cell.special === SPECIAL.WRAPPED) S.sarmalPatladi++;
  });

  const extraRemovals = getSpecialRemovals(currentGrid, matched);
  extraRemovals.forEach((key) => matched.add(key));

  // === OLCUM NOKTASI 2: nihai silme kumesi ===
  matched.forEach((k) => {
    const [c, r] = k.split(',').map(Number);
    const cell = currentGrid[c]?.[r];
    if (cell && cell.special === SPECIAL.COLOR_BOMB) S.bombSessizSilindi++;
  });

  let { grid: collapsed, fallMap } = removeAndCollapse(currentGrid, matched);
  collapsed = applyLuckyDrops(collapsed, fallMap);
  if (specials.length > 0) collapsed = placeSpecials(collapsed, specials);
  if (cascadeLevel > 40) return collapsed; // guvenlik
  return processCascade(collapsed, cascadeLevel + 1);
}

function triggerColorFrenzy(currentGrid, frenzy) {
  S.frenzy++;
  const converted = currentGrid.map((c) => c.slice());
  frenzy.cells.forEach(({ col, row }) => {
    const cell = converted[col][row];
    if (cell) {
      const dir = Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V;
      converted[col][row] = { ...cell, special: dir };
    }
  });
  const frenzyMatched = new Set(frenzy.cells.map(({ col, row }) => `${col},${row}`));
  say(converted, frenzyMatched, 'bombPatladi'); // frenzy yolu da olculuyor
  const extra = getSpecialRemovals(converted, frenzyMatched);
  extra.forEach((k) => frenzyMatched.add(k));
  frenzyMatched.forEach((k) => {
    const [c, r] = k.split(',').map(Number);
    const cell = converted[c]?.[r];
    if (cell && cell.special === SPECIAL.COLOR_BOMB) S.bombSessizSilindi++;
  });
  let { grid: collapsed2, fallMap: fm2 } = removeAndCollapse(converted, frenzyMatched);
  collapsed2 = applyLuckyDrops(collapsed2, fm2);
  return processCascade(collapsed2, 0);
}

function initBoard(withBomb) {
  let board = createBoard();
  let safety = 0;
  while (findMatches(board).matched.size > 0 && safety < 100) { board = createBoard(); safety++; }
  if (withBomb) {
    const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
    board[c][r] = { ...board[c][r], special: SPECIAL.COLOR_BOMB, id: `bst_bomb_${c}_${r}` };
  }
  return board;
}

function bombaSayisi(grid) {
  let n = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
    if (grid[c][r]?.special === SPECIAL.COLOR_BOMB) n++;
  return n;
}

const OYUN = Number(process.argv[2] || 200);
const HAMLE = Number(process.argv[3] || 25);
let cekicleSilinenBomba = 0;

for (let g = 0; g < OYUN; g++) {
  let grid = initBoard(true);       // 75 coin'lik startBomb booster'i AKTIF
  let chainStreak = 0;
  for (let m = 0; m < HAMLE; m++) {
    // gecerli takaslari topla, rastgele birini oyna (bomba komsulugunu ONCELIKLE dene)
    const moves = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1 && findMatches(swapCells(grid, c, r, c + 1, r)).matched.size > 0) moves.push([c, r, c + 1, r]);
      if (r < ROWS - 1 && findMatches(swapCells(grid, c, r, c, r + 1)).matched.size > 0) moves.push([c, r, c, r + 1]);
    }
    if (moves.length === 0) { grid = shuffleBoard(grid); S.karistirma++; continue; }
    // bombayi ICEREN takas varsa onu sec (en iyimser senaryo — patlatmaya CALISIYORUZ)
    const bombaliMoves = moves.filter(([a, b, c2, d]) =>
      grid[a][b]?.special === SPECIAL.COLOR_BOMB || grid[c2][d]?.special === SPECIAL.COLOR_BOMB);
    const havuz = bombaliMoves.length > 0 ? bombaliMoves : moves;
    const [c1, r1, c2, r2] = havuz[Math.floor(Math.random() * havuz.length)];
    S.hamle++;
    frenzyFired = false;
    let swapped = swapCells(grid, c1, r1, c2, r2);
    chainStreak++;
    if (chainStreak >= CHAIN_BONUS_THRESHOLD) {
      chainStreak = 0;
      const cands = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
        if (swapped[c][r]?.special === SPECIAL.NONE) cands.push({ c, r });
      if (cands.length) {
        const p = cands[Math.floor(Math.random() * cands.length)];
        const out = swapped.map((c) => c.slice());
        out[p.c][p.r] = { ...out[p.c][p.r], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
        swapped = out;
      }
    }
    grid = processCascade(swapped, 0);
  }
  // Cekic yolu: bomba hala tahtadaysa uzerine cekic vur (GameScreen:215-229 kopyasi)
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (grid[c][r]?.special === SPECIAL.COLOR_BOMB) {
      S.cekic++;
      const matchedSet = new Set([`${c},${r}`]);
      // DIKKAT: GameScreen cekic yolunda getSpecialRemovals CAGIRMIYOR
      const res = removeAndCollapse(grid, matchedSet);
      cekicleSilinenBomba++;
      grid = res.grid;
    }
  }
}

console.log('=== BAGIMSIZ E2E: %d oyun x %d hamle (startBomb booster AKTIF, bombali takas ONCELIKLI) ===', OYUN, HAMLE);
console.log('oynanan hamle: %d | cascade adimi: %d | frenzy: %d | karistirma: %d', S.hamle, S.cascade, S.frenzy, S.karistirma);
console.log('');
console.log('  COLOR_BOMB  -> getSpecialRemovals matched icinde (= PATLADI): %d', S.bombPatladi);
console.log('  KONTROL CIZGILI -> matched icinde (= patladi):                %d', S.cizgiliPatladi);
console.log('  KONTROL SARMAL  -> matched icinde (= patladi):                %d', S.sarmalPatladi);
console.log('');
console.log('  determineSpecials ile URETILEN COLOR_BOMB (5-eslesme): %d', S.bombVarOlanKare);
console.log('  COLOR_BOMB nihai silme kumesinde (SESSIZ silinme):     %d', S.bombSessizSilindi);
console.log('  cekicle silinen COLOR_BOMB (patlamadan):               %d', cekicleSilinenBomba);
