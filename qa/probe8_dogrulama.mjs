// BAGIMSIZ DOGRULAMA: 5'li + kesisim -> renk bombasi kayboluyor mu?
// Fark: tahtayi elle "T" diye kurmuyorum; GERCEK bir oyuncu HAMLESIYLE kuruyorum.
const R = 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src';
const { findMatches, determineSpecials, swapCells, hasValidMoves } = await import(R + '/engine/BoardEngine.js');
const { COLS, ROWS, SPECIAL } = await import(R + '/constants/kural.js');

const NAME = { 0: 'YOK', 1: 'CIZGILI_H', 2: 'CIZGILI_V', 3: 'SARMAL', 4: 'RENK_BOMBASI' };
let n = 0;
const base = (c, r) => (c + 2 * r) % 6; // 3'lu dizi uretmeyen taban desen

function mk(overrides) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    g[c] = [];
    for (let r = 0; r < ROWS; r++) {
      const key = `${c},${r}`;
      const type = key in overrides ? overrides[key] : base(c, r);
      g[c][r] = { type, special: SPECIAL.NONE, id: 'p' + n++ };
    }
  }
  return g;
}

function rapor(ad, ov, beklenen) {
  const g = mk(ov);
  const once = findMatches(g);
  console.log(`\n=== ${ad} ===`);
  console.log('  hamle ONCESI eslesme sayisi:', once.matched.size, once.matched.size === 0 ? '(temiz — hamle gecerli)' : '!! TAHTA ZATEN BOZUK, olcum gecersiz');
  // oyuncu (4,5)'teki sekeri (4,4) ile takas ediyor — bitisik, yasal hamle
  const s = swapCells(g, 4, 5, 4, 4);
  const { matchGroups } = findMatches(s);
  console.log('  hamle SONRASI gruplar:', matchGroups.map(x => `${x.direction}(tip${x.type}):${x.cells.length}`).join(', ') || 'yok');
  const sp = determineSpecials(matchGroups);
  const gorulen = sp.map(x => `${NAME[x.special]}@${x.col},${x.row}`).join(', ') || 'HICBIRI';
  console.log('  BEKLENEN:', beklenen);
  console.log('  GORULEN :', gorulen);
  return sp;
}

// --- KALIBRASYON (bilinen-iyi vaka): duz 5'li, kesisim YOK ---
rapor('KONTROL: sadece yatay 5 (kesisim yok)', {
  '2,4': 0, '3,4': 0, '5,4': 0, '6,4': 0, // yatay kol
  '4,5': 0,                                // takas edilecek seker
  '4,4': 2,                                // yerine gececek
}, 'RENK_BOMBASI');

// --- SINAV: yatay 5 + dikey 3 (T sekli), tek hamleyle ---
const sp = rapor('SINAV: yatay 5 + dikey 3 (T), tek yasal hamle', {
  '2,4': 0, '3,4': 0, '5,4': 0, '6,4': 0, // yatay kol
  '4,2': 0, '4,3': 0,                      // dikey kol
  '4,1': 3,                                // dikey kolun pre-swap tasmasini engelle
  '4,5': 0,                                // takas edilecek seker
  '4,4': 2,
}, 'RENK_BOMBASI (+ belki SARMAL) — 5-li vaadi HowToPlayModal.js:34');

const bombaVar = sp.some(x => x.special === SPECIAL.COLOR_BOMB);
console.log('\nHUKUM: 5-li dizi olusmasina ragmen renk bombasi', bombaVar ? 'VERILDI -> bulgu CURUTULDU' : 'VERILMEDI -> bulgu GERCEK');
