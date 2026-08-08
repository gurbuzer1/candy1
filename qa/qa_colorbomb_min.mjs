// EN KUCUK DETERMINISTIK KANIT — rastgelelik yok.
// Elle kurulmus tahta: 0. satirda 5 tane tip-0 seker, ORTADAKI (2,0) COLOR_BOMB.
// Beklenen (HowToPlayModal:34 + getSpecialRemovals:187): bomba matched'e girer,
// tum tip-0 sekerler silinir.
import { findMatches, getSpecialRemovals } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

const g = [];
for (let c = 0; c < COLS; c++) {
  g[c] = [];
  for (let r = 0; r < ROWS; r++) g[c][r] = { type: (c + r * 2) % 6 === 0 ? 3 : (c * 3 + r) % 6, special: SPECIAL.NONE, id: `x${c}_${r}` };
}
// 0. satiri temizle: 0..4 tip 0, gerisi tip 5 (bitisik eslesme olmasin)
for (let c = 0; c < COLS; c++) g[c][0] = { type: c < 5 ? 0 : (c % 2 ? 5 : 4), special: SPECIAL.NONE, id: `h${c}` };
// alt satirlar tip-0 icersin ki bomba "hepsini sil" yapinca fark gorulsun
g[7][3] = { type: 0, special: SPECIAL.NONE, id: 'z1' };
g[8][5] = { type: 0, special: SPECIAL.NONE, id: 'z2' };
// ORTAYA COLOR_BOMB
g[2][0] = { ...g[2][0], special: SPECIAL.COLOR_BOMB };

const { matched } = findMatches(g);
console.log('matched kumesi        :', [...matched].sort().join(' '));
console.log('bomba (2,0) matched\'te mi? ->', matched.has('2,0'), '   BEKLENEN: true');
const extra = getSpecialRemovals(g, matched);
console.log('getSpecialRemovals ek silme:', extra.size, 'hucre  ', [...extra].sort().join(' '));
console.log('');
console.log('BOMBASIZ kontrol (ayni tahta, ozel yok):');
const g2 = g.map((c) => c.slice());
g2[2][0] = { ...g2[2][0], special: SPECIAL.NONE };
console.log('  matched:', [...findMatches(g2).matched].sort().join(' '));
console.log('');
console.log('CIZGILI kontrol (ayni yere STRIPED_V):');
const g3 = g.map((c) => c.slice());
g3[2][0] = { ...g3[2][0], special: SPECIAL.STRIPED_V };
const m3 = findMatches(g3).matched;
console.log('  (2,0) matched\'te mi? ->', m3.has('2,0'), ' | ek silme:', getSpecialRemovals(g3, m3).size, 'hucre');
