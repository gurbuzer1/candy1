// BAGIMSIZ dogrulama — probe6/probe2'ye guvenmeden, GameScreen akisini birebir taklit et.
// GameScreen.js:611-618 handleShuffle  -> setGrid(shuffleBoard(grid));  cascade YOK
// GameScreen.js:270-297 trySwap        -> findMatches(swapped).matched.size > 0 ise KABUL
const R = 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/';
const {
  createBoard, swapCells, findMatches, determineSpecials, calculateScore, hasValidMoves, shuffleBoard,
} = await import(R + 'engine/BoardEngine.js');
const { COLS, ROWS } = await import(R + 'constants/kural.js');

const key = (c, r) => `${c},${r}`;

// --- 1) TEK, SOMUT VAKA: booster shuffle sonrasi tahtayi goster -------------
let board = null, shuf = null, m0 = null;
for (let i = 0; i < 500; i++) {
  const g = createBoard();
  const s = shuffleBoard(g);
  const mm = findMatches(s).matched;
  if (mm.size > 0) { board = g; shuf = s; m0 = mm; break; }
}
console.log('=== 1. handleShuffle sonrasi tahta (booster, 50 coin) ===');
console.log('karistirma ONCESI (createBoard) hazir eslesme:', findMatches(board).matched.size);
console.log('karistirma SONRASI hazir eslesme hucresi     :', m0.size, '->', [...m0].join(' '));
console.log('  (handleShuffle processCascade CAGIRMIYOR -> bu sekerler ekranda patlamadan duruyor)');
let art = '';
for (let r = 0; r < ROWS; r++) {
  let line = '';
  for (let c = 0; c < COLS; c++) line += (m0.has(key(c, r)) ? '[' + shuf[c][r].type + ']' : ' ' + shuf[c][r].type + ' ');
  art += line + '\n';
}
console.log(art);

// --- 2) KESIN vaka: yerelde HICBIR SEY yapmayan takas KABUL ediliyor mu? ----
// "yerel" olcut: takasin degistirdigi iki hucreden biri eslesmede olmali.
let bulundu = null;
outer:
for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
  for (const [dc, dr] of [[1, 0], [0, 1]]) {
    const c2 = c + dc, r2 = r + dr;
    if (c2 >= COLS || r2 >= ROWS) continue;
    const sw = swapCells(shuf, c, r, c2, r2);
    const { matched, matchGroups } = findMatches(sw);
    if (matched.size === 0) continue;
    const yerel = matched.has(key(c, r)) || matched.has(key(c2, r2));
    if (!yerel) { bulundu = { c, r, c2, r2, matched, matchGroups }; break outer; }
  }
}
console.log('=== 2. Yerelde OLU takas (iki seker de hicbir eslesmeye girmiyor) ===');
if (!bulundu) { console.log('  bulunamadi'); }
else {
  const { c, r, c2, r2, matched, matchGroups } = bulundu;
  const sw = swapCells(shuf, c, r, c2, r2);
  const puan = calculateScore(matchGroups, determineSpecials(matchGroups), 0);
  console.log(`  takas (${c},${r}) <-> (${c2},${r2})  tipler: ${shuf[c][r].type} <-> ${shuf[c2][r2].type}`);
  console.log('  takas edilen hucreler eslesmede mi? ', matched.has(key(c, r)) || matched.has(key(c2, r2)));
  console.log('  trySwap kurali findMatches(swapped).matched.size =', matched.size, '> 0  -> KABUL');
  console.log('  => hamle -1 (GameScreen.js:283-285), verilen puan =', puan);
  console.log('  BEKLENEN: gecersiz takas -> errorHaptic + geri al (GameScreen.js:299-305)');
  console.log('  GORULEN : gecerli sayildi, hamle dustu, bedava puan verildi');
}

// --- 3) BUYUKLUK: her takas kabul mu? -------------------------------------
console.log('\n=== 3. Buyukluk: 300 karistirma, 144 komsu takas ===');
let N = 300, kabul = 0, yerel = 0, hazir = 0, hepsiKabul = 0, toplamPuan = 0, kabulPuan = 0;
for (let i = 0; i < N; i++) {
  const s = shuffleBoard(createBoard());
  if (findMatches(s).matched.size > 0) hazir++;
  let k = 0, y = 0, tot = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      const sw = swapCells(s, c, r, c2, r2);
      const { matched, matchGroups } = findMatches(sw);
      if (matched.size === 0) continue;
      k++; tot += calculateScore(matchGroups, determineSpecials(matchGroups), 0);
      if (matched.has(key(c, r)) || matched.has(key(c2, r2))) y++;
    }
  }
  if (k === 144) hepsiKabul++;
  kabul += k; yerel += y; kabulPuan += tot;
}
console.log('  hazir eslesme birakan tahta      : %d/%d (%s%%)', hazir, N, (100 * hazir / N).toFixed(1));
console.log('  144 takasin HEPSI kabul edilen tahta: %d/%d', hepsiKabul, N);
console.log('  ort KABUL edilen takas / 144     : %s', (kabul / N).toFixed(1));
console.log('  ort GERCEKTEN yerel eslesme uretn : %s', (yerel / N).toFixed(1));
console.log('  => ort %s takas OLU ama kabul ediliyor', ((kabul - yerel) / N).toFixed(1));

// --- 4) Otomatik karistirma yolu (GameScreen.js:353) ne siklikta tetikleniyor?
console.log('\n=== 4. hasValidMoves()==false ne siklikta? (otomatik karistirma kapisi) ===');
let ns = 0, M = 3000;
for (let i = 0; i < M; i++) if (!hasValidMoves(createBoard())) ns++;
console.log('  taze tahtada gecerli hamle YOK: %d/%d', ns, M);
