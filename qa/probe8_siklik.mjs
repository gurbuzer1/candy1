// BUYUKLUK OLCUMU: bu durum gercek oyunda ne siklikta olur?
// Rastgele tahta + rastgele YASAL hamle + tam kaskad zinciri (motorun kendi yollari).
const R = 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src';
const E = await import(R + '/engine/BoardEngine.js');
const { COLS, ROWS, SPECIAL } = await import(R + '/constants/kural.js');

// determineSpecials'in ICINDEKI mantigi TEKRAR YAZMADAN olcuyorum:
// "5+ grup vardi ama uretilen ozeller arasinda RENK_BOMBASI yok" -> yutulmus.
function yutulduMu(matchGroups) {
  const besli = matchGroups.filter(g => g.cells.length >= 5);
  if (besli.length === 0) return null;
  const sp = E.determineSpecials(matchGroups);
  const bomba = sp.filter(s => s.special === SPECIAL.COLOR_BOMB).length;
  return { besliSayisi: besli.length, bombaSayisi: bomba };
}

let hamle = 0, besliOlay = 0, yutulan = 0, ornek = null;
const HAMLE_HEDEF = 20000;

while (hamle < HAMLE_HEDEF) {
  let grid = E.createBoard();
  for (let m = 0; m < 40 && hamle < HAMLE_HEDEF; m++) {
    // yasal hamleleri topla
    const hamleler = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1 && E.findMatches(E.swapCells(grid, c, r, c + 1, r)).matched.size > 0) hamleler.push([c, r, c + 1, r]);
      if (r < ROWS - 1 && E.findMatches(E.swapCells(grid, c, r, c, r + 1)).matched.size > 0) hamleler.push([c, r, c, r + 1]);
    }
    if (hamleler.length === 0) { grid = E.shuffleBoard(grid); continue; }
    const h = hamleler[Math.floor(Math.random() * hamleler.length)];
    grid = E.swapCells(grid, ...h);
    hamle++;
    // kaskad zinciri
    for (let k = 0; k < 30; k++) {
      const { matched, matchGroups } = E.findMatches(grid);
      if (matched.size === 0) break;
      const o = yutulduMu(matchGroups);
      if (o) {
        besliOlay++;
        if (o.bombaSayisi < o.besliSayisi) {
          yutulan++;
          if (!ornek) ornek = { kaskad: k, gruplar: matchGroups.map(g => `${g.direction}(tip${g.type}):${g.cells.length}`) };
        }
      }
      const specials = E.determineSpecials(matchGroups);
      const extra = E.getSpecialRemovals(grid, matched);
      extra.forEach(x => matched.add(x));
      grid = E.removeAndCollapse(grid, matched).grid;
      grid = E.placeSpecials(grid, specials);
    }
  }
}

console.log('oynanan hamle          :', hamle);
console.log('5+ dizi olusan olay    :', besliOlay);
console.log('renk bombasi YUTULAN   :', yutulan, `(5+ olaylarin %${(100 * yutulan / (besliOlay || 1)).toFixed(1)}'i)`);
console.log('hamle basina yutulma   :', (yutulan / hamle).toFixed(5), `-> ~her ${Math.round(hamle / (yutulan || 1))} hamlede 1`);
console.log('ilk ornek              :', JSON.stringify(ornek));
