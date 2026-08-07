// shuffleBoard hazir eslesme birakinca ne oluyor?
// GameScreen.trySwap kurali: findMatches(swapped).matched.size > 0 ise takas GECERLI
// sayilir, hamle DUSER ve puan verilir. Tahtada zaten eslesme varsa bu kural
// HER takasi gecerli yapar.
import { createBoard, swapCells, findMatches, shuffleBoard } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';

const N = Number(process.argv[2] || 200);
let kabulSum = 0, gercekSum = 0, hazirMatch = 0;
for (let i = 0; i < N; i++) {
  const s = shuffleBoard(createBoard());
  const onceki = findMatches(s).matched;
  if (onceki.size > 0) hazirMatch++;
  let kabul = 0, gercek = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      const sw = swapCells(s, c, r, c2, r2);
      const m = findMatches(sw).matched;
      if (m.size > 0) kabul++;                       // GameScreen'in kabul ettigi
      // gercekten YENI eslesme uretti mi: takastan ETKILENEN hucrelerden biri
      // eslesmede olmali
      let yeni = false;
      m.forEach((k) => { if (k === `${c},${r}` || k === `${c2},${r2}`) yeni = true; });
      if (yeni) gercek++;
    }
  }
  kabulSum += kabul; gercekSum += gercek;
}
console.log('%d karistirma sonrasi (toplam 144 komsu takas / tahta):', N);
console.log('  hazir eslesme birakan tahta: %d/%d', hazirMatch, N);
console.log('  GameScreen.trySwap KABUL ettigi takas (hamle duser + puan): ort %s / 144', (kabulSum / N).toFixed(1));
console.log('  gercekten yeni eslesme ureten takas:                       ort %s / 144', (gercekSum / N).toFixed(1));
