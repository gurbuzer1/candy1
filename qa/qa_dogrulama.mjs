/**
 * BAGIMSIZ DOGRULAMA (QA curutme turu) — autoplay.mjs'ten AYRI yazildi.
 * Soru: bulgu olcum hatasi mi, urun mu?
 * Fark: burada oyuncu EN IYI hamleyi degil, RASTGELE gecerli hamleyi oynuyor
 * (yani mumkun olan EN KOTU makul oyuncu). Frenzy oyuncu becerisine bagli
 * degilse, beceriksiz oyuncu da 3 yildiz almalidir.
 * Ayrica her hamlede frenzy kontrol anindaki OZEL SAYISI olculuyor
 * (guvercin yuvasi garantisi P>=79 duz hucre ister).
 */
const B = 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/';
const { createBoard, swapCells, findMatches, determineSpecials, getSpecialRemovals,
        removeAndCollapse, placeSpecials, calculateScore, hasValidMoves, shuffleBoard }
  = await import(B + 'engine/BoardEngine.js');
const { COLS, ROWS, SPECIAL } = await import(B + 'constants/kural.js');
const { LEVELS } = await import(B + 'constants/levels.js');
const { FRENZY_THRESHOLD, LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE, CHAIN_BONUS_THRESHOLD }
  = await import(B + 'constants/economy.js');
// storage.js AsyncStorage'a bagli -> duz node'da import edilemiyor.
// computeStars src/utils/storage.js:75-80'den BIREBIR kopyalandi:
function computeStars(score, level) {
  if (score >= level.target3) return 3;
  if (score >= level.target2) return 2;
  if (score >= level.target1) return 1;
  return 0;
}

// GameScreen.js:55-71 birebir
function detectColorFrenzy(grid) {
  const cells = [[], [], [], [], [], []];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const k = grid[c]?.[r];
    if (k && k.special === SPECIAL.NONE && k.type >= 0 && k.type < 6) cells[k.type].push({ col: c, row: r });
  }
  for (let t = 0; t < 6; t++) if (cells[t].length >= FRENZY_THRESHOLD) return { type: t, cells: cells[t] };
  return null;
}
function applyLuckyDrops(grid, fallMap) { // GameScreen.js:74
  if (!fallMap) return grid;
  const out = grid.map((c) => c.slice());
  for (const e of fallMap) {
    if (!e.isNew) continue;
    const cell = out[e.col]?.[e.toRow];
    if (!cell || cell.special !== SPECIAL.NONE) continue;
    const roll = Math.random();
    if (roll < LUCKY_WRAPPED_CHANCE) out[e.col][e.toRow] = { ...cell, special: SPECIAL.WRAPPED };
    else if (roll < LUCKY_WRAPPED_CHANCE + LUCKY_STRIPED_CHANCE)
      out[e.col][e.toRow] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
  }
  return out;
}
const nSpecial = (g) => { let k = 0; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r]?.special !== SPECIAL.NONE) k++; return k; };

const stat = { checks: 0, fires: 0, specialsAtCheck: [], plainAtCheck: [], pigeonSafe: 0 };

function play(levelIdx, useFrenzy) {
  const lv = LEVELS[levelIdx];
  let grid = createBoard(), safety = 0;
  while (findMatches(grid).matched.size > 0 && safety++ < 100) grid = createBoard();
  let score = 0, moves = lv.moves, chain = 0, frenzyFired = false, frenzies = 0;

  function triggerFrenzy(g, f) {
    const conv = g.map((c) => c.slice());
    for (const { col, row } of f.cells) conv[col][row] = { ...conv[col][row], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
    score += f.cells.length * 80;                                  // GameScreen.js:494
    const fm = new Set(f.cells.map(({ col, row }) => `${col},${row}`));
    for (const k of getSpecialRemovals(conv, fm)) fm.add(k);        // GameScreen.js:516
    score += fm.size * 60;                                         // GameScreen.js:519
    const { grid: g2, fallMap } = removeAndCollapse(conv, fm);
    return applyLuckyDrops(g2, fallMap);
  }
  function cascade(g0) {
    let cur = g0, lvl = 0, guard = 0;
    for (; guard++ < 500;) {
      const { matched, matchGroups } = findMatches(cur);
      if (matched.size === 0) {
        if (!frenzyFired) {
          stat.checks++;
          const sp = nSpecial(cur); stat.specialsAtCheck.push(sp); stat.plainAtCheck.push(81 - sp);
          if (81 - sp >= 79) stat.pigeonSafe++;
          const f = detectColorFrenzy(cur);
          if (f) stat.fires++;
          if (useFrenzy && f) { frenzyFired = true; frenzies++; cur = triggerFrenzy(cur, f); lvl = 0; continue; }
        }
        if (!hasValidMoves(cur)) { cur = shuffleBoard(cur); continue; }
        return cur;
      }
      const specials = determineSpecials(matchGroups);
      for (const k of getSpecialRemovals(cur, matched)) matched.add(k);
      score += calculateScore(matchGroups, specials, lvl);
      let { grid: col, fallMap } = removeAndCollapse(cur, matched);
      col = applyLuckyDrops(col, fallMap);
      if (specials.length) col = placeSpecials(col, specials);
      cur = col; lvl++;
    }
    return cur;
  }
  // RASTGELE gecerli hamle — beceri YOK
  function randomMove(g) {
    const all = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      if (findMatches(swapCells(g, c, r, c2, r2)).matched.size > 0) all.push([c, r, c2, r2]);
    }
    return all.length ? all[Math.floor(Math.random() * all.length)] : null;
  }
  while (moves > 0) {
    const mv = randomMove(grid);
    if (!mv) { grid = shuffleBoard(grid); continue; }
    frenzyFired = false;                       // GameScreen.js:274
    grid = swapCells(grid, ...mv); moves--; chain++;
    if (chain >= CHAIN_BONUS_THRESHOLD) {      // GameScreen.js:289
      chain = 0;
      const cand = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.special === SPECIAL.NONE) cand.push([c, r]);
      if (cand.length) { const [c, r] = cand[Math.floor(Math.random() * cand.length)];
        grid = grid.map((x) => x.slice());
        grid[c][r] = { ...grid[c][r], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V, id: 'ch' + Math.random() }; }
    }
    grid = cascade(grid);
  }
  const won = score >= lv.target1;
  return { score, stars: won ? computeStars(score, lv) : 0, frenzies, moves: lv.moves };
}

const RUNS = Number(process.argv[2] || 10);
const useFrenzy = process.env.NOFRENZY !== '1';
const levels = (process.argv[3] || '1,5,10,15,20,25,30').split(',').map(Number);
console.log(`RASTGELE (beceriksiz) oyuncu | frenzy=${useFrenzy ? 'ACIK' : 'KAPALI'} | ${RUNS} oyun/seviye`);
console.log('sv | hamle |    t1 /    t3 | ort.skor | 3yildiz% | 1yildiz% | frenzy/hamle');
let all3 = 0, tot = 0;
for (const n of levels) {
  const res = []; for (let i = 0; i < RUNS; i++) res.push(play(n - 1, useFrenzy));
  const avg = Math.round(res.reduce((a, b) => a + b.score, 0) / RUNS);
  const p3 = 100 * res.filter((r) => r.stars === 3).length / RUNS;
  const p1 = 100 * res.filter((r) => r.stars >= 1).length / RUNS;
  all3 += res.filter((r) => r.stars === 3).length; tot += RUNS;
  const fpm = (res.reduce((a, b) => a + b.frenzies / b.moves, 0) / RUNS).toFixed(2);
  console.log(`${String(n).padStart(2)} | ${String(LEVELS[n-1].moves).padStart(5)} | ${String(LEVELS[n-1].target1).padStart(5)} / ${String(LEVELS[n-1].target3).padStart(5)} | ${String(avg).padStart(8)} | ${String(p3.toFixed(0)).padStart(7)}% | ${String(p1.toFixed(0)).padStart(7)}% | ${fpm}`);
}
console.log(`\nTOPLAM 3-yildiz: ${all3}/${tot} (${(100*all3/tot).toFixed(1)}%)`);
const sp = stat.specialsAtCheck;
console.log(`Frenzy kontrol ani: ${stat.checks} kez bakildi, ${stat.fires} kez KOSUL DOGRU (${(100*stat.fires/stat.checks).toFixed(2)}%)`);
console.log(`  o andaki ozel seker sayisi: ort ${(sp.reduce((a,b)=>a+b,0)/sp.length).toFixed(2)}, max ${Math.max(...sp)}`);
console.log(`  guvercin-yuvasi GARANTILI (duz hucre >= 79) olan kontrol: ${stat.pigeonSafe}/${stat.checks} (${(100*stat.pigeonSafe/stat.checks).toFixed(1)}%)`);
