/**
 * autoplay2 — DUZELTILMIS GameScreen.js akisini BIREBIR taklit eden bassiz oyuncu.
 * qa/autoplay.mjs SILINMEDI ama ARTIK BOZUK BIR OLCUM ARACIDIR (kendi basindaki
 * uyari blokuna bak): eski frenzy tetikleyicisini ve olu placeSpecials'i tasir,
 * 30 seviyenin hepsinde %100, NOFRENZY=1 ile %0 uretir. HICBIR yonde kullanma.
 *
 * Fark listesi (hepsi kaynaktan okunuyor, sabit kopyalanmiyor):
 *   - reserveSpecials  : ozel seker collapse'TAN ONCE yerine yaziliyor
 *   - colorBombSwap    : takas ile renk bombasi aktivasyonu
 *   - frenzyReadyColor : sarj tabanli frenzy + tetikte SIFIRLAMA
 *   - shuffleBoard     : eslesmesiz + oynanabilir tahta
 *
 * Kullanim: node qa/autoplay2.mjs <oyun_sayisi> <seviyeler>
 *   ENV: NOFRENZY=1 frenzy'yi kapatir, NOBOMB=1 bomba takasini kapatir.
 *        SEED=<sayi> tohumlu (TEKRAR EDILEBILIR) rastgelelik.
 *
 * ==========================================================================
 * 2026-08-07 — KUTUPHANE OLARAK DA KULLANILIR
 * ==========================================================================
 * `tests/seviye_tablosu.test.js` botu GERCEKTEN kosturur (zorluk egrisinin ters
 * donmesi eskiden suite'ten kaciyordu). Bunun icin:
 *   - import yollari MUTLAK `file:///C:/...` yerine GORELI hale getirildi
 *     (depo baska bir yola klonlanirsa arac sessizce olmesin diye),
 *   - `playLevel` / `orneklem` / `orneklemHamle` DISA ACILDI,
 *   - `SEED` ile TOHUMLANABILIR RNG eklendi: ayni tohum ayni sonucu verir,
 *     boylece bot kosturan test RASTGELE KIRMIZI YANMAZ.
 * CLI davranisi degismedi (tohum verilmezse gercek Math.random).
 */
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, reserveSpecials,
  colorBombSwap, calculateScore, hasValidMoves, shuffleBoard,
} from '../src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from '../src/constants/kural.js';
import { LEVELS } from '../src/constants/levels.js';
import {
  LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE, CHAIN_BONUS_THRESHOLD,
  FRENZY_CHARGE_TARGET, frenzyReadyColor,
} from '../src/constants/economy.js';

/** mulberry32 — kucuk, hizli, TEKRAR EDILEBILIR. */
export function tohumluRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `fn`'i tohumlu Math.random ile kosturur ve ESKISINI GERI KOYAR. */
export function tohumlaKostur(seed, fn) {
  if (seed === undefined || seed === null || seed === '') return fn();
  const eski = Math.random;
  Math.random = tohumluRng(Number(seed));
  try { return fn(); } finally { Math.random = eski; }
}

// GameScreen.detectColorFrenzy birebir
function detectColorFrenzy(grid, charge) {
  const t = frenzyReadyColor(charge);
  if (t < 0) return null;
  const cells = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const candy = grid[c]?.[r];
    if (candy && candy.special === SPECIAL.NONE && candy.type === t) cells.push({ col: c, row: r });
  }
  if (cells.length === 0) return null;
  return { type: t, cells };
}

function applyLuckyDrops(grid, fallMap) {
  if (!fallMap) return grid;
  const out = grid.map((c) => c.slice());
  fallMap.forEach((e) => {
    if (!e.isNew) return;
    const cell = out[e.col]?.[e.toRow];
    if (!cell || cell.special !== SPECIAL.NONE) return;
    const roll = Math.random();
    if (roll < LUCKY_WRAPPED_CHANCE) out[e.col][e.toRow] = { ...cell, special: SPECIAL.WRAPPED };
    else if (roll < LUCKY_WRAPPED_CHANCE + LUCKY_STRIPED_CHANCE) out[e.col][e.toRow] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
  });
  return out;
}

const countSpecials = (g) => { let k = 0; for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r] && g[c][r].special !== SPECIAL.NONE) k++; return k; };

/**
 * Tek bir seviyeyi sonuna kadar oynar.
 * @param levelIdx     LEVELS icindeki sifir tabanli indeks
 * @param movesOverride hamle sayisini ZORLAR (skor dagilimi yalnizca hamle
 *                      sayisina bagli oldugu icin kalibrasyon bunu kullanir)
 */
export function playLevel(levelIdx, movesOverride) {
  const lv = LEVELS[levelIdx];
  let grid = createBoard();
  let safety = 0;
  while (findMatches(grid).matched.size > 0 && safety < 100) { grid = createBoard(); safety++; }

  let score = 0, moves = movesOverride == null ? lv.moves : movesOverride, chainStreak = 0;
  let frenzyFired = false;
  let charge = [0, 0, 0, 0, 0, 0];
  let specialsPlaced = 0, frenzyCount = 0, maxCascade = 0, bombSwaps = 0, dirtyBoards = 0;

  function processCascade(g, level, shuffleDepth = 0) {
    let cur = g, lvl = level, sd = shuffleDepth;
    for (;;) {
      const { matched, matchGroups } = findMatches(cur);
      if (matched.size === 0) {
        if (!frenzyFired && !process.env.NOFRENZY) {
          const f = detectColorFrenzy(cur, charge);
          if (f) {
            frenzyFired = true; frenzyCount++;
            charge = [0, 0, 0, 0, 0, 0];
            cur = triggerFrenzy(cur, f); lvl = 0; continue;
          }
        }
        if (!hasValidMoves(cur)) {
          if (sd < 3) { cur = shuffleBoard(cur); sd++; lvl = 0; continue; }
          return cur;
        }
        return cur;
      }
      if (lvl > maxCascade) maxCascade = lvl;
      const specials = determineSpecials(matchGroups);
      getSpecialRemovals(cur, matched).forEach((k) => matched.add(k));

      const res = specials.length > 0
        ? reserveSpecials(cur, matched, specials)
        : { grid: cur, matched, placed: [] };
      specialsPlaced += res.placed.length;
      res.matched.forEach((key) => {
        const [c, r] = key.split(',').map(Number);
        const cell = cur[c]?.[r];
        if (cell && cell.type >= 0 && cell.type < 6) charge[cell.type] += 1;
      });

      score += calculateScore(matchGroups, specials, lvl);
      let { grid: collapsed, fallMap } = removeAndCollapse(res.grid, res.matched);
      cur = applyLuckyDrops(collapsed, fallMap);
      lvl++;
    }
  }

  function triggerFrenzy(g, frenzy) {
    const converted = g.map((c) => c.slice());
    frenzy.cells.forEach(({ col, row }) => {
      const cell = converted[col][row];
      if (cell) converted[col][row] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
    });
    score += frenzy.cells.length * 80;
    const fm = new Set(frenzy.cells.map(({ col, row }) => `${col},${row}`));
    getSpecialRemovals(converted, fm).forEach((k) => fm.add(k));
    score += fm.size * 60;
    let { grid: collapsed2, fallMap: f2 } = removeAndCollapse(converted, fm);
    return applyLuckyDrops(collapsed2, f2);
  }

  function detonate(g, blast) {
    const all = new Set(blast);
    getSpecialRemovals(g, all).forEach((k) => all.add(k));
    all.forEach((key) => {
      const [c, r] = key.split(',').map(Number);
      const cell = g[c]?.[r];
      if (cell && cell.type >= 0 && cell.type < 6) charge[cell.type] += 1;
    });
    score += all.size * 60;
    let { grid: collapsed, fallMap } = removeAndCollapse(g, all);
    return applyLuckyDrops(collapsed, fallMap);
  }

  function bestSwap(g) {
    let best = null, bestScore = -1, bestBomb = null;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 >= COLS || r2 >= ROWS) continue;
        const s = swapCells(g, c, r, c2, r2);
        const bomb = process.env.NOBOMB ? null : colorBombSwap(s, c, r, c2, r2);
        const { matched, matchGroups } = findMatches(s);
        if (matched.size === 0 && !bomb) continue;
        let v;
        if (bomb) {
          v = bomb.size + 20;
        } else {
          const sp = determineSpecials(matchGroups);
          const ex = getSpecialRemovals(s, matched);
          v = matched.size + ex.size + sp.length * 5;
        }
        if (v > bestScore) { bestScore = v; best = [c, r, c2, r2]; bestBomb = bomb; }
      }
    }
    return best ? { mv: best, bomb: bestBomb } : null;
  }

  while (moves > 0) {
    const pick = bestSwap(grid);
    if (!pick) { grid = shuffleBoard(grid); continue; }
    frenzyFired = false;
    grid = swapCells(grid, ...pick.mv);
    moves--;
    chainStreak++;
    if (pick.bomb) {
      bombSwaps++;
      grid = detonate(grid, pick.bomb);
      grid = processCascade(grid, 0);
      if (findMatches(grid).matched.size > 0) dirtyBoards++;
      continue;
    }
    if (chainStreak >= CHAIN_BONUS_THRESHOLD) {
      chainStreak = 0;
      const cands = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.special === SPECIAL.NONE) cands.push({ c, r });
      if (cands.length) {
        const p = cands[Math.floor(Math.random() * cands.length)];
        grid = grid.map((c) => c.slice());
        grid[p.c][p.r] = { ...grid[p.c][p.r], special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V, id: 'chain' + Math.random() };
      }
    }
    grid = processCascade(grid, 0);
    if (findMatches(grid).matched.size > 0) dirtyBoards++;
  }
  return { score, specialsPlaced, frenzyCount, maxCascade, bombSwaps, dirtyBoards, endSpecials: countSpecials(grid) };
}

/** Bir seviyeden `n` oyunluk orneklem (tohumlu -> TEKRAR EDILEBILIR). */
export function orneklem(levelIdx, n, seed) {
  return tohumlaKostur(seed, () => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(playLevel(levelIdx));
    return out;
  });
}

/** Oyun basina tohum: (taban, indeks) -> 32 bit. */
export function oyunTohumu(taban, i) {
  return (Math.imul(Number(taban) | 0, 2654435761) + Math.imul(i | 0, 40503)) >>> 0;
}

/**
 * Skor dagilimi YALNIZCA hamle sayisina baglidir (hedefler oyunu etkilemez),
 * bu yuzden kalibrasyon 30 seviye yerine 6 farkli hamle degerini ornekler.
 *
 * ⚠️ ORTAK RASTGELE SAYILAR (variance reduction): her oyun KENDI tohumuyla
 * baslar, tohum yalnizca (taban, oyun indeksi)'ne baglidir — hamle sayisina
 * DEGIL. Boylece "36 hamlelik i. oyun", "32 hamlelik i. oyun"un AYNI tahtada,
 * AYNI zar dizisiyle 4 hamle daha devam ettirilmis halidir. Iki hamle degeri
 * arasindaki gecme orani farki artik ESLESTIRILMIS bir karsilastirmadir ve
 * varyansi bagimsiz orneklemeye gore cok daha dusuktur. Hamle SINIRI gecisleri
 * (10->11, 15->16, 20->21, 25->26) tam olarak burada olculuyor; olcum
 * gurultusu orada en buyuktu (bagimsiz orneklemeyle n=250'de +8 puana kadar).
 */
export function orneklemHamle(moves, n, seed) {
  if (seed === undefined || seed === null || seed === '') {
    const out = [];
    for (let i = 0; i < n; i++) out.push(playLevel(0, moves).score);
    return out;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(tohumlaKostur(oyunTohumu(seed, i), () => playLevel(0, moves).score));
  }
  return out;
}

// --------------------------------------------------------------------------
// CLI (yalnizca dogrudan calistirilinca; import edilince SESSIZ kalir)
// --------------------------------------------------------------------------
const dogrudan = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('qa/autoplay2.mjs');
if (dogrudan) {
  const RUNS = Number(process.argv[2] || 30);
  const which = process.argv[3] ? process.argv[3].split(',').map(Number) : [1, 2, 5, 10, 15, 20, 25, 30];
  console.log('FRENZY_CHARGE_TARGET =', FRENZY_CHARGE_TARGET, '| SEED =', process.env.SEED || '(tohumsuz)');
  console.log('sev | hml | t1 / t2 / t3 | ort.skor | min-max | %>=t1 | %>=t2 | %>=t3 | frenzy/oyun | eslesmeden konan ozel/oyun | bombaTakas/oyun | kirli tahta');
  for (const num of which) {
    const idx = num - 1;
    const lv = LEVELS[idx];
    const res = orneklem(idx, RUNS, process.env.SEED);
    const sc = res.map((r) => r.score).sort((a, b) => a - b);
    const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
    const pct = (t) => (100 * sc.filter((s) => s >= t).length / sc.length).toFixed(0);
    const mean = (k) => (res.reduce((a, b) => a + b[k], 0) / RUNS).toFixed(1);
    console.log('%s | %s | %s / %s / %s | %s | %s-%s | %s%% | %s%% | %s%% | %s | %s | %s | %d',
      String(num).padStart(2), String(lv.moves).padStart(3), lv.target1, lv.target2, lv.target3,
      String(Math.round(avg)).padStart(7), sc[0], sc[sc.length - 1],
      pct(lv.target1).padStart(3), pct(lv.target2).padStart(3), pct(lv.target3).padStart(3),
      mean('frenzyCount'), mean('specialsPlaced'), mean('bombSwaps'),
      res.reduce((a, b) => a + b.dirtyBoards, 0));
  }
}
