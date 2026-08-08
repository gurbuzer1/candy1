// BAGIMSIZ DOGRULAMA — zincirleme patlama bulgusu
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, placeSpecials,
  hasValidMoves, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE, CHAIN_BONUS_THRESHOLD }
  from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

const NAMES = { 0: '-', 1: 'STRIPED_H', 2: 'STRIPED_V', 3: 'WRAPPED', 4: 'COLOR_BOMB' };
let n = 0;
const mk = (fn) => {
  const g = [];
  for (let c = 0; c < COLS; c++) { g[c] = []; for (let r = 0; r < ROWS; r++) g[c][r] = { type: fn(c, r), special: SPECIAL.NONE, id: 'p' + (n++) }; }
  return g;
};
const base = (c, r) => (c + 2 * r) % 6;

console.log('### 1. DETERMINISTIK: patlamanin icinde kalan ozel seker ne oluyor?');
for (const victim of [SPECIAL.STRIPED_V, SPECIAL.WRAPPED, SPECIAL.COLOR_BOMB]) {
  const g = mk(base);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'patlayan' };
  g[7][4] = { type: 1, special: victim, id: 'kurban' };
  const matched = new Set(['4,4']);
  const extra = getSpecialRemovals(g, matched);
  extra.forEach(k => matched.add(k));
  const kurbanSilindiMi = matched.has('7,4');
  const kurbanEtkisi = [...extra].filter(k => !k.endsWith(',4')).length; // satir 4 disi = kurbanin katkisi
  const { grid: after } = removeAndCollapse(g, matched);
  console.log(`  STRIPED_H (4,4) patladi; (7,4)=${NAMES[victim]}`);
  console.log(`    kurban silindi mi: ${kurbanSilindiMi} | kurbanin KENDI patlamasindan gelen hucre: ${kurbanEtkisi} (beklenen>0 zincir varsa)`);
  console.log(`    (7,4) tahtada kaldi mi: ${after[7][4] ? 'evet(yeni seker dustu)' : 'hayir'} | toplam silinen: ${matched.size}`);
}

console.log('\n### 2. IKINCI TUR calistirilsaydi ne olurdu? (referans)');
{
  const g = mk(base);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'a' };
  g[7][4] = { type: 1, special: SPECIAL.STRIPED_V, id: 'b' };
  let matched = new Set(['4,4']);
  // urunun yaptigi: TEK gecis
  let tek = new Set(matched);
  getSpecialRemovals(g, tek).forEach(k => tek.add(k));
  // sabit-nokta: tekrar tekrar
  let fix = new Set(matched); let prev = 0;
  while (fix.size !== prev) { prev = fix.size; getSpecialRemovals(g, fix).forEach(k => fix.add(k)); }
  console.log(`  TEK GECIS (urunun davranisi): ${tek.size} hucre`);
  console.log(`  SABIT NOKTA (zincir olsaydi):  ${fix.size} hucre`);
  console.log(`  fark: ${fix.size - tek.size} hucre`);
}

console.log('\n### 3. CEKIC (hammer) yolu — GameScreen.js:215-229 birebir');
{
  const g = mk(base);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'cekiclenen' };
  // GameScreen hammer: matchedSet = tek hucre, getSpecialRemovals YOK
  const matchedSet = new Set(['4,4']);
  const { grid: collapsed } = removeAndCollapse(g, matchedSet);
  console.log(`  cekicle STRIPED_H'e vuruldu -> silinen hucre: ${matchedSet.size} (zincir/patlama olsaydi 9)`);
  // karsilastirma: ayni sekere eslesmeyle dokunulsa
  const m2 = new Set(['4,4']); getSpecialRemovals(g, m2).forEach(k => m2.add(k));
  console.log(`  ayni seker ESLESMEYLE patlasa: ${m2.size} hucre`);
  console.log(`  -> cekic 100 coin (economy) ve ozel sekeri bosa harciyor`);
}

console.log('\n### 4. GERCEK OYUN AKISI (chain bonus DAHIL) — kac ozel uretildi, kaci bosa gitti?');
function applyLuckyDrops(grid, fallMap) {
  const out = grid.map((c) => c.slice());
  fallMap.forEach((e) => {
    if (!e.isNew) return;
    const cell = out[e.col]?.[e.toRow];
    if (!cell || cell.special !== SPECIAL.NONE) return;
    const roll = Math.random();
    if (roll < LUCKY_WRAPPED_CHANCE) { out[e.col][e.toRow] = { ...cell, special: SPECIAL.WRAPPED }; uretilen++; }
    else if (roll < LUCKY_WRAPPED_CHANCE + LUCKY_STRIPED_CHANCE) { out[e.col][e.toRow] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V }; uretilen++; }
  });
  return out;
}
let uretilen = 0, yutulan = 0, tetiklenen = 0, hamle = 0, kayipHucre = 0;
const GAMES = Number(process.argv[2] || 60), MOVES = 25;
for (let gme = 0; gme < GAMES; gme++) {
  let grid = createBoard();
  let streak = 0;
  for (let mv = 0; mv < MOVES; mv++) {
    // RASTGELE gecerli hamle (probe5 hep ilk hamleyi seciyordu — yanliligi kirmak icin)
    const moves = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      if (findMatches(swapCells(grid, c, r, c2, r2)).matched.size > 0) moves.push([c, r, c2, r2]);
    }
    if (moves.length === 0) { grid = shuffleBoard(grid); continue; }
    const [a, b, c2, r2] = moves[Math.floor(Math.random() * moves.length)];
    grid = swapCells(grid, a, b, c2, r2);
    hamle++;
    // chain bonus (GameScreen triggerChainBonus)
    streak++;
    if (streak >= CHAIN_BONUS_THRESHOLD) {
      streak = 0;
      const cand = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.special === SPECIAL.NONE) cand.push([c, r]);
      if (cand.length) {
        const [pc, pr] = cand[Math.floor(Math.random() * cand.length)];
        grid = grid.map(x => x.slice());
        grid[pc][pr] = { ...grid[pc][pr], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
        uretilen++;
      }
    }
    for (;;) {
      const { matched, matchGroups } = findMatches(grid);
      if (matched.size === 0) break;
      matched.forEach(k => { const [c, r] = k.split(',').map(Number); if (grid[c]?.[r]?.special !== SPECIAL.NONE) tetiklenen++; });
      const extra = getSpecialRemovals(grid, matched);
      // sabit nokta ile karsilastir: zincir olsaydi kac EK hucre giderdi
      const fix = new Set(matched); let prev = 0;
      while (fix.size !== prev) { prev = fix.size; getSpecialRemovals(grid, fix).forEach(k => fix.add(k)); }
      const tek = new Set(matched); extra.forEach(k => tek.add(k));
      kayipHucre += fix.size - tek.size;
      extra.forEach((k) => {
        if (matched.has(k)) return;
        const [c, r] = k.split(',').map(Number);
        if (grid[c]?.[r] && grid[c][r].special !== SPECIAL.NONE) yutulan++;
      });
      extra.forEach((k) => matched.add(k));
      const specials = determineSpecials(matchGroups);
      uretilen += specials.length;
      let { grid: col, fallMap } = removeAndCollapse(grid, matched);
      grid = placeSpecials(applyLuckyDrops(col, fallMap), specials);
    }
  }
}
console.log(`  ${GAMES} oyun x ${MOVES} hamle = ${hamle} gecerli hamle`);
console.log(`  URETILEN ozel seker (eslesme + sans + chain bonus): ${uretilen}`);
console.log(`  TETIKLENEN (eslesmeye girip patlayan):              ${tetiklenen}`);
console.log(`  YUTULAN (patlamada patlamadan silinen):             ${yutulan}`);
console.log(`  -> uretilen ozel sekerlerin %${(100 * yutulan / uretilen).toFixed(1)}'i bosa gitti`);
console.log(`  -> patlayan ozellerin %${(100 * yutulan / (tetiklenen + yutulan)).toFixed(1)}'i sessizce oldu`);
console.log(`  -> zincir olsaydi EK silinecek hucre: ${kayipHucre} (hamle basina ${(kayipHucre / hamle).toFixed(2)})`);
