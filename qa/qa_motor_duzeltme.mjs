/**
 * DUZELTMELERIN KANITI — probe1/probe7'nin karsiligi, YENI yollar uzerinden.
 * probe1.mjs ve probe7.mjs SILINMEDI; onlar hala ESKI yolu (placeSpecials,
 * takas-aktivasyonsuz bomba) olcuyor ve orada 0 gormeye devam edecekler.
 */
import {
  createBoard, findMatches, determineSpecials, getSpecialRemovals,
  removeAndCollapse, reserveSpecials, colorBombSwap, isPlayableSwap,
  swapCells, shuffleBoard, hasValidMoves,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

let n = 0;
const mk = (fn) => {
  const g = [];
  for (let c = 0; c < COLS; c++) { g[c] = []; for (let r = 0; r < ROWS; r++) g[c][r] = { type: fn(c, r), special: SPECIAL.NONE, id: 'p' + (n++) }; }
  return g;
};
const base = (c, r) => (c + 2 * r) % 6;
const countSpecials = (g) => { let k = 0; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r] && g[c][r].special !== SPECIAL.NONE) k++; return k; };

console.log('=== BULGU 1: 4-lu eslesmeden dogan ozel seker TAHTAYA KONUYOR MU? ===');
{
  const g = mk((c, r) => (r === 4 && c >= 2 && c <= 5) ? 0 : base(c, r));
  const { matched, matchGroups } = findMatches(g);
  const specials = determineSpecials(matchGroups);
  console.log('  determineSpecials ->', JSON.stringify(specials));
  getSpecialRemovals(g, matched).forEach(k => matched.add(k));
  const res = reserveSpecials(g, matched, specials);
  console.log('  reserveSpecials: yerlestirilen =', res.placed.length, '| silinecekler kumesi', matched.size, '->', res.matched.size);
  const { grid: after } = removeAndCollapse(res.grid, res.matched);
  console.log('  collapse SONRASI tahtadaki ozel seker sayisi:', countSpecials(after));
  console.log('  hedef hucre (3,4) special =', after[3][4].special, '(2 = STRIPED_V bekleniyor)');
}

console.log('\n=== BULGU 7: 5-li dizi baska eslesmeyle KESISIRSE ne veriyor? ===');
{
  const g = mk((c, r) => {
    if (r === 4 && c >= 2 && c <= 6) return 0;
    if (c === 4 && r >= 3 && r <= 5) return 0;
    return base(c, r);
  });
  const { matchGroups } = findMatches(g);
  console.log('  gruplar:', matchGroups.map(x => `${x.direction}:${x.cells.length}`).join(', '));
  const sp = determineSpecials(matchGroups);
  console.log('  determineSpecials ->', JSON.stringify(sp), ' (special 4 = COLOR_BOMB, 3 = WRAPPED)');
}

console.log('\n=== BULGU 6: zincirleme patlama (cizgili -> cizgili) ===');
{
  const g = mk(base);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'patlayan' };
  g[7][4] = { type: 1, special: SPECIAL.STRIPED_V, id: 'kurban' };
  const extra = getSpecialRemovals(g, new Set(['4,4']));
  const sutun7 = [...extra].filter(k => k.startsWith('7,')).length;
  console.log('  silinen toplam hucre:', extra.size, '| sutun 7 den silinen:', sutun7, '(zincir varsa 9)');
}

console.log('\n=== BULGU 3a: patlamanin icinde kalan RENK BOMBASI tetikleniyor mu? ===');
{
  const g = mk(base);
  g[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'patlayan' };
  g[6][4] = { ...g[6][4], type: 3 };            // bombanin komsusu, silinecekler icinde
  g[7][4] = { type: 5, special: SPECIAL.COLOR_BOMB, id: 'bomba' };
  const extra = getSpecialRemovals(g, new Set(['4,4']));
  const satirDisi = [...extra].filter(k => !k.endsWith(',4'));
  console.log('  silinen toplam:', extra.size, '| satir 4 DISINDA silinen:', satirDisi.length, '(0 ise bomba yine olu)');
}

console.log('\n=== BULGU 3b: TAKAS ile renk bombasi aktivasyonu ===');
{
  const g = mk(base);
  g[0][0] = { type: 0, special: SPECIAL.COLOR_BOMB, id: 'bomba' };
  const hedefTip = g[1][0].type;
  let ayniTip = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r].type === hedefTip) ayniTip++;
  const blast = colorBombSwap(g, 0, 0, 1, 0);
  console.log('  bomba + duz seker (tip %d, tahtada %d adet) -> silinen: %d', hedefTip, ayniTip, blast ? blast.size : 0);
  const yok = colorBombSwap(g, 3, 3, 4, 3);
  console.log('  bombasiz takas -> ', yok === null ? 'null (dogru)' : 'YANLIS: ' + yok.size);
  g[1][0] = { type: 1, special: SPECIAL.COLOR_BOMB, id: 'bomba2' };
  console.log('  bomba + bomba -> silinen:', colorBombSwap(g, 0, 0, 1, 0).size, '(81 bekleniyor)');
}

console.log('\n=== BULGU 3c: bomba takasi GECERLI HAMLE sayiliyor mu? ===');
{
  const g = mk(base);
  // eslesme URETMEYEN bir komsu takas bul
  let bulundu = null;
  for (let c = 0; c < COLS - 1 && !bulundu; c++) for (let r = 0; r < ROWS; r++) {
    if (findMatches(swapCells(g, c, r, c + 1, r)).matched.size === 0) { bulundu = [c, r]; break; }
  }
  const [c, r] = bulundu;
  console.log('  olu takas (%d,%d)<->(%d,%d) : isPlayableSwap =', c, r, c + 1, r, isPlayableSwap(g, c, r, c + 1, r));
  g[c][r] = { ...g[c][r], special: SPECIAL.COLOR_BOMB };
  console.log('  AYNI takas, (%d,%d) RENK BOMBASI iken : isPlayableSwap =', c, r, isPlayableSwap(g, c, r, c + 1, r));
}

console.log('\n=== BULGU 4: shuffleBoard hazir eslesme birakiyor mu? ===');
{
  const N = 300;
  let kirli = 0, hamlesiz = 0, toplamKirliHucre = 0;
  for (let i = 0; i < N; i++) {
    const s = shuffleBoard(createBoard());
    const m = findMatches(s).matched.size;
    if (m > 0) { kirli++; toplamKirliHucre += m; }
    if (!hasValidMoves(s)) hamlesiz++;
  }
  console.log('  %d karistirma -> hazir eslesme birakan: %d (%s%%) | gecerli hamlesi olmayan: %d',
    N, kirli, (100 * kirli / N).toFixed(1), hamlesiz);
}
