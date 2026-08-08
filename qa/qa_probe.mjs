// BAGIMSIZ QA PROBU - QA ajani tarafindan sifirdan yazildi.
// GameScreen.js:378-470 cagri sirasini birebir taklit eder.
import {
  findMatches, determineSpecials, getSpecialRemovals,
  removeAndCollapse, placeSpecials, swapCells, createBoard, hasValidMoves,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

const P = (t, s = SPECIAL.NONE) => ({ type: t, special: s, id: `x${Math.random()}` });

// ---- TEST 1: ELDE KURULMUS 4'LU YATAY ESLESME -------------------------
// 0. satira 4 tane tip-0 koy, geri kalani match olusturmayacak sekilde doldur.
function buildGrid(filler) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    g[c] = [];
    for (let r = 0; r < ROWS; r++) g[c][r] = P(filler(c, r));
  }
  return g;
}
// desen: hicbir 3'lu olusmayan taban (tip = (c + 2*r) % 5 -> yatay ardisik farkli,
// dikey ardisik farkli). Dogrula.
let grid = buildGrid((c, r) => (c + 2 * r) % 5);
{
  const m = findMatches(grid);
  console.log('[0] taban tahtada eslesme sayisi (0 olmali):', m.matched.size);
}
// simdi (0..3, 4) hucrelerine tip 9? CANDY_COUNT sinirli, tip 0 kullan.
for (let c = 0; c < 4; c++) grid[c][4] = P(0);
// yanindaki 5. sutunun 4. satiri 0 olmasin diye kontrol
if (grid[4][4].type === 0) grid[4][4] = P(1);

const { matched, matchGroups } = findMatches(grid);
console.log('[1] matchGroups:', JSON.stringify(matchGroups.map(g => ({ n: g.cells.length, dir: g.direction, type: g.type }))));
const specials = determineSpecials(matchGroups);
console.log('[2] determineSpecials URETTI:', JSON.stringify(specials));

const extra = getSpecialRemovals(grid, matched);
extra.forEach(k => matched.add(k));
console.log('[3] matched.size (extra sonrasi):', matched.size);
console.log('[3b] ozel hedef hucre matched icinde mi:',
  specials.map(s => `${s.col},${s.row}=${matched.has(`${s.col},${s.row}`)}`).join(' '));

let { grid: collapsed } = removeAndCollapse(grid, matched);
let nullCount = 0;
for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (collapsed[c][r] === null) nullCount++;
console.log('[4] removeAndCollapse SONRASI null hucre sayisi:', nullCount);

const before = countSpecials(collapsed);
const after0 = placeSpecials(collapsed, specials);
const after = countSpecials(after0);
console.log('[5] placeSpecials ONCESI ozel seker sayisi:', before);
console.log('[6] placeSpecials SONRASI ozel seker sayisi:', after);
console.log('[7] hedef hucredeki seker:', JSON.stringify(specials.map(s => ({
  at: `${s.col},${s.row}`, beklenen_special: s.special,
  gorulen_special: after0[s.col][s.row]?.special,
}))));

function countSpecials(g) {
  let n = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (g[c][r] && g[c][r].special !== SPECIAL.NONE) n++;
  }
  return n;
}

// ---- TEST 2: placeSpecials IZOLE - null hucreye yazabiliyor mu? --------
{
  const g = buildGrid((c, r) => (c + 2 * r) % 5);
  g[3][3] = null;
  const out = placeSpecials(g, [{ col: 3, row: 3, type: 0, special: SPECIAL.STRIPED_H }]);
  console.log('[8] IZOLE null hucreye yazim (fonksiyon calisiyor mu?):',
    out[3][3] ? `EVET special=${out[3][3].special}` : 'HAYIR');
  const g2 = buildGrid((c, r) => (c + 2 * r) % 5);
  const out2 = placeSpecials(g2, [{ col: 3, row: 3, type: 0, special: SPECIAL.STRIPED_H }]);
  console.log('[9] IZOLE DOLU hucreye yazim:',
    out2[3][3].special === SPECIAL.STRIPED_H ? 'YAZDI' : `YAZMADI (special=${out2[3][3].special})`);
}

// ---- TEST 3: 5'li ve L/T --------------------------------------------
function scenario(name, mutate) {
  const g = buildGrid((c, r) => (c + 2 * r) % 5);
  mutate(g);
  const { matched: m, matchGroups: mg } = findMatches(g);
  const sp = determineSpecials(mg);
  const ex = getSpecialRemovals(g, m); ex.forEach(k => m.add(k));
  const { grid: col } = removeAndCollapse(g, m);
  const out = placeSpecials(col, sp);
  const placed = sp.filter(s => out[s.col][s.row]?.special === s.special).length;
  console.log(`[${name}] uretilen ozel=${sp.length} (${sp.map(s=>s.special).join(',')}) | tahtaya KONAN=${placed}`);
}
scenario('5LI', g => { for (let c = 0; c < 5; c++) g[c][4] = P(0); if (g[5][4].type===0) g[5][4]=P(1); });
scenario('L_SEKLI', g => {
  for (let c = 0; c < 3; c++) g[c][4] = P(0);
  for (let r = 4; r < 7; r++) g[0][r] = P(0);
});

// ---- TEST 4: 200 RASGELE TAM OTOMATIK HAMLE ---------------------------
let totalSpecialsGenerated = 0, totalSpecialsPlaced = 0, moves = 0;
for (let game = 0; game < 20; game++) {
  let b = createBoard();
  for (let mv = 0; mv < 30; mv++) {
    // gecerli hamle bul
    let done = false;
    outer:
    for (let c = 0; c < COLS && !done; c++) for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        if (c + dc >= COLS || r + dr >= ROWS) continue;
        const sw = swapCells(b, c, r, c + dc, r + dr);
        if (findMatches(sw).matched.size > 0) { b = sw; done = true; break outer; }
      }
    }
    if (!done) break;
    moves++;
    // cascade dongusu
    for (let lvl = 0; lvl < 20; lvl++) {
      const { matched: m, matchGroups: mg } = findMatches(b);
      if (m.size === 0) break;
      const sp = determineSpecials(mg);
      const ex = getSpecialRemovals(b, m); ex.forEach(k => m.add(k));
      const { grid: col, fallMap } = removeAndCollapse(b, m);
      let next = col;
      if (sp.length > 0) next = placeSpecials(col, sp);
      totalSpecialsGenerated += sp.length;
      totalSpecialsPlaced += sp.filter(s => next[s.col][s.row]?.special === s.special).length;
      b = next;
    }
  }
}
console.log(`[10] 20 oyun / ${moves} hamle: determineSpecials URETTI=${totalSpecialsGenerated}, tahtaya KONAN=${totalSpecialsPlaced}`);
