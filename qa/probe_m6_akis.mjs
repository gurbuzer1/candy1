/**
 * PROBE — M6 mutasyonunu DAVRANISLA yakalayan olcumun kesif calismasi.
 *
 * M6 (dogrulama ajaninin kanitladigi mutasyon):
 *   GameScreen.js  removeAndCollapse(workGrid, toRemove)
 *              ->  removeAndCollapse(currentGrid, matched)
 * Urun kirilir (eslesmeden ozel seker DOGMAZ) ama eski suite 92/92 yesil kalir,
 * cunku tek koruma `/reserveSpecials\(/.test(src)` regex'iydi.
 *
 * Bu probe: GameScreen'i mini React ile MOUNT eder, tahtayi SABITLER, gercek bir
 * takas yapar ve urunun KENDI cagirdigi removeAndCollapse'in DONDURDUGU tahtada
 * ozel seker var mi diye bakar.
 */
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mount, loadModule, flattenNodes } from '../tests/qa_akis_render.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BE_PATH = path.join(KOK, 'src', 'engine', 'BoardEngine.js');
const GAME = path.join(KOK, 'src', 'screens', 'GameScreen.js');

const BE = loadModule(BE_PATH);
const { COLS, ROWS, SPECIAL } = loadModule(path.join(KOK, 'src', 'constants', 'kural.js'));

const taban = (c, r) => (c + 2 * r) % 6;

function kurulumAra() {
  for (let R = 2; R < ROWS - 1; R++) {
    const g = [];
    let n = 0;
    for (let c = 0; c < COLS; c++) {
      g[c] = [];
      for (let r = 0; r < ROWS; r++) g[c][r] = { type: taban(c, r), special: SPECIAL.NONE, id: `t${n++}` };
    }
    // Hedef: (2,R) (3,R) (5,R) tip 0, (4,R-1) tip 0, (4,R) baska bir tip.
    const tip = 0;
    g[2][R] = { ...g[2][R], type: tip };
    g[3][R] = { ...g[3][R], type: tip };
    g[5][R] = { ...g[5][R], type: tip };
    g[4][R - 1] = { ...g[4][R - 1], type: tip };
    // (4,R) tip 0 OLMAMALI, ayrica komsu eslesme uretmemeli
    for (let alt = 1; alt < 6; alt++) {
      g[4][R] = { ...g[4][R], type: alt };
      if (BE.findMatches(g).matched.size !== 0) continue;
      const s = BE.swapCells(g, 4, R - 1, 4, R);
      const { matched, matchGroups } = BE.findMatches(s);
      if (matchGroups.length !== 1) continue;
      if (matchGroups[0].cells.length !== 4) continue;
      const sp = BE.determineSpecials(matchGroups);
      if (sp.length !== 1) continue;
      return { g, R, alt, matched, sp };
    }
  }
  return null;
}

const kur = kurulumAra();
console.log('kurulum:', kur ? { R: kur.R, alt: kur.alt, ozel: kur.sp[0] } : 'BULUNAMADI');
assert.ok(kur, 'sabit tahta kurulumu bulunamadi');

// ---- deterministik RNG + hizli zamanlayici -------------------------------
function tohumlu(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const gercekRandom = Math.random;
const gercekSetTimeout = globalThis.setTimeout;
const gercekCreateBoard = BE.createBoard;
const gercekRemove = BE.removeAndCollapse;
const gercekReserve = BE.reserveSpecials;

const cagrilar = [];
Math.random = tohumlu(12345);
globalThis.setTimeout = (fn, ms) => {
  if (ms >= 1000) return 0;          // 5 sn'lik ipucu sayaci sinavi bekletmesin
  return setImmediate(fn);
};
BE.createBoard = () => kur.g.map((c) => c.map((x) => ({ ...x })));
BE.reserveSpecials = (...a) => {
  const out = gercekReserve(...a);
  cagrilar.push({ ad: 'reserveSpecials', args: a, out });
  return out;
};
BE.removeAndCollapse = (...a) => {
  const out = gercekRemove(...a);
  cagrilar.push({ ad: 'removeAndCollapse', args: a, out });
  return out;
};

const m = mount(GAME, {
  levelNum: 4,
  save: { inventory: {} },
  boosters: {},
  onLevelEnd: () => {},
  onNextLevel: () => {},
  onReplay: () => {},
  onBack: () => {},
  onUseBooster: () => {},
  backRequest: 0,
});

const tahta = () => flattenNodes(m.tree).find((n) => n.name === 'GameBoard');
console.log('mount tamam, GameBoard var mi:', !!tahta());

tahta().props.onCellTap(4, kur.R - 1);
tahta().props.onCellTap(4, kur.R);
for (let i = 0; i < 500; i++) await new Promise((r) => setImmediate(r));

Math.random = gercekRandom;
globalThis.setTimeout = gercekSetTimeout;
BE.createBoard = gercekCreateBoard;
BE.removeAndCollapse = gercekRemove;
BE.reserveSpecials = gercekReserve;

console.log('render sayisi:', m.renders);
console.log('cagri sirasi:', cagrilar.map((c) => c.ad).join(' -> '));

const ilkRemove = cagrilar.find((c) => c.ad === 'removeAndCollapse');
console.log('ilk removeAndCollapse var mi:', !!ilkRemove);
if (ilkRemove) {
  const g = ilkRemove.out.grid;
  let ozel = 0;
  const yerler = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (g[c][r] && g[c][r].special !== SPECIAL.NONE) { ozel++; yerler.push(`${c},${r}:${g[c][r].special}`); }
  }
  console.log('collapse SONRASI ozel seker sayisi:', ozel, yerler.join(' '));
}
const ilkReserve = cagrilar.find((c) => c.ad === 'reserveSpecials');
if (ilkReserve && ilkRemove) {
  console.log('removeAndCollapse[0] === reserveSpecials.out.grid :', ilkRemove.args[0] === ilkReserve.out.grid);
  console.log('removeAndCollapse[1] === reserveSpecials.out.matched :', ilkRemove.args[1] === ilkReserve.out.matched);
}
