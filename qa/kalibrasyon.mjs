/**
 * kalibrasyon.mjs — SEVIYE HEDEFLERINI OLCMEK icin kosum takimi.
 *
 * qa/autoplay.mjs (ESKI akis) ve qa/autoplay2.mjs (duzeltilmis akis) SILINMEDI.
 * Bu dosya autoplay2'nin oyun dongusunu alir ve uc sey ekler:
 *
 *   1) TOHUMLU RASTGELELIK  — Math.random mulberry32 ile degistirilir, boylece
 *      ayni tohum ayni dagilimi verir; olcum tekrarlanabilir.
 *   2) HAMLE SAYISI PARAMETRESI — LEVELS'tan bagimsiz olarak "M hamlelik bir
 *      seviye kac puan getirir" sorusunu sorabiliriz. Seviye tablosunu
 *      olcumden TURETMEK icin gerekli.
 *   3) UC OYUNCU POLITIKASI — otomatik oyuncunun insana gore nerede durdugunu
 *      OLCMEK icin. Tek bir bot "iyi mi kotu mu" sorusunu cevaplayamaz;
 *      alt ve ust sinir gerekir:
 *
 *        rastgele  : gecerli hamleler arasindan rastgele secer (dikkatsiz oyuncu,
 *                    ALT SINIR).
 *        acgozlu   : autoplay2'nin politikasi. Eslesme ureten takaslari tarar,
 *                    "kac hucre gider + zincirleme patlama + ozel seker" en
 *                    yuksek olani secer. 1 hamlelik gorus, cascade PLANLAMAZ.
 *        ileri     : her aday takasi SONUNA KADAR simule eder (cascade dahil)
 *                    ve GERCEK puan artisi en yuksek olani secer. Dusen
 *                    sekerlerin rastgeleligini de gorur -> INSAN USTU. UST SINIR.
 *
 *      Insan oyuncu "acgozlu" ile "ileri" arasindadir: acgozlu'den daha iyi
 *      cunku tahtayi butun gorur ve zincir kurmaya calisir; "ileri"den kotudur
 *      cunku yeni dusecek sekerleri goremez.
 *
 * Kullanim:
 *   node qa/kalibrasyon.mjs dagilim <oyun> <hamleListesi>   -> hamle->skor tablosu
 *   node qa/kalibrasyon.mjs politika <oyun> <hamleListesi>  -> 3 politika karsilastirmasi
 *   node qa/kalibrasyon.mjs tablo <oyun>                    -> LEVELS'i oldugu gibi olc
 */
import {
  createBoard, swapCells, findMatches, determineSpecials,
  getSpecialRemovals, removeAndCollapse, reserveSpecials,
  colorBombSwap, calculateScore, hasValidMoves, shuffleBoard,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
import { LEVELS } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/levels.js';
import {
  LUCKY_STRIPED_CHANCE, LUCKY_WRAPPED_CHANCE, CHAIN_BONUS_THRESHOLD,
  FRENZY_CHARGE_TARGET, frenzyReadyColor,
} from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/economy.js';

/* ---------- tohumlu RNG ---------- */
let rngState = 0;
function mulberry32() {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = mulberry32;
const seedSet = (s) => { rngState = s | 0; };
const seedGet = () => rngState;

/* ---------- GameScreen yardimcilari (birebir) ---------- */
function detectColorFrenzy(grid, charge) {
  const t = frenzyReadyColor(charge);
  if (t < 0) return null;
  const cells = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const candy = grid[c]?.[r];
    if (candy && candy.special === SPECIAL.NONE && candy.type === t) cells.push({ col: c, row: r });
  }
  return cells.length === 0 ? null : { type: t, cells };
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
    else if (roll < LUCKY_WRAPPED_CHANCE + LUCKY_STRIPED_CHANCE) {
      out[e.col][e.toRow] = { ...cell, special: Math.random() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
    }
  });
  return out;
}

/* ---------- tek hamlenin TUM sonucu (saf: state alir, yeni state doner) ---------- */
function applyMove(st, pick) {
  // st = { grid, score, charge, chainStreak }
  let grid = swapCells(st.grid, ...pick.mv);
  let score = st.score;
  let charge = st.charge.slice();
  let chainStreak = st.chainStreak + 1;
  let frenzyFired = false;
  let stats = { specialsPlaced: 0, frenzyCount: 0, maxCascade: 0, bombSwap: pick.bomb ? 1 : 0 };

  function chargeUp(g, keys) {
    keys.forEach((key) => {
      const [c, r] = key.split(',').map(Number);
      const cell = g[c]?.[r];
      if (cell && cell.type >= 0 && cell.type < 6) charge[cell.type] += 1;
    });
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
    const { grid: g2, fallMap: f2 } = removeAndCollapse(converted, fm);
    return applyLuckyDrops(g2, f2);
  }

  function processCascade(g0, level0, shuffleDepth0 = 0) {
    let cur = g0, lvl = level0, sd = shuffleDepth0;
    for (;;) {
      const { matched, matchGroups } = findMatches(cur);
      if (matched.size === 0) {
        if (!frenzyFired) {
          const f = detectColorFrenzy(cur, charge);
          if (f) {
            frenzyFired = true; stats.frenzyCount++;
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
      if (lvl > stats.maxCascade) stats.maxCascade = lvl;
      const specials = determineSpecials(matchGroups);
      getSpecialRemovals(cur, matched).forEach((k) => matched.add(k));
      const res = specials.length > 0
        ? reserveSpecials(cur, matched, specials)
        : { grid: cur, matched, placed: [] };
      stats.specialsPlaced += res.placed.length;
      chargeUp(cur, res.matched);
      score += calculateScore(matchGroups, specials, lvl);
      const { grid: collapsed, fallMap } = removeAndCollapse(res.grid, res.matched);
      cur = applyLuckyDrops(collapsed, fallMap);
      lvl++;
    }
  }

  if (pick.bomb) {
    const all = new Set(pick.bomb);
    getSpecialRemovals(grid, all).forEach((k) => all.add(k));
    chargeUp(grid, all);
    score += all.size * 60;
    const { grid: collapsed, fallMap } = removeAndCollapse(grid, all);
    grid = applyLuckyDrops(collapsed, fallMap);
    grid = processCascade(grid, 0);
    return { grid, score, charge, chainStreak, stats };
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
  return { grid, score, charge, chainStreak, stats };
}

/* ---------- aday hamleler ---------- */
function candidateMoves(g) {
  const out = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const c2 = c + dc, r2 = r + dr;
      if (c2 >= COLS || r2 >= ROWS) continue;
      const s = swapCells(g, c, r, c2, r2);
      const bomb = colorBombSwap(s, c, r, c2, r2);
      const { matched, matchGroups } = findMatches(s);
      if (matched.size === 0 && !bomb) continue;
      let h;
      if (bomb) h = bomb.size + 20;
      else {
        const sp = determineSpecials(matchGroups);
        h = matched.size + getSpecialRemovals(s, matched).size + sp.length * 5;
      }
      out.push({ mv: [c, r, c2, r2], bomb, h });
    }
  }
  return out;
}

/* ---------- politikalar ---------- */
const POLICIES = {
  // ALT SINIR: gecerli hamleler arasindan rastgele. Hicbir degerlendirme yok.
  rastgele(st, cands) { return cands[Math.floor(Math.random() * cands.length)]; },

  // autoplay2'nin politikasi: 1 hamlelik acgozlu sezgisel.
  acgozlu(st, cands) {
    let best = cands[0];
    for (const c of cands) if (c.h > best.h) best = c;
    return best;
  },

  // UST SINIR: her adayi SONUNA KADAR (cascade + frenzy + sansli dusus dahil)
  // simule eder, gercek puan artisina bakar. Dusecek sekerleri de gordugu icin
  // hicbir insanin ulasamayacagi bir gorus. RNG durumu her denemeden once geri
  // sarilir -> degerlendirme oyunun rastgeleligini TUKETMEZ.
  ileri(st, cands) {
    const save = seedGet();
    let best = cands[0], bestGain = -1;
    for (const c of cands) {
      seedSet(save);
      const r = applyMove(st, c);
      const gain = r.score - st.score;
      if (gain > bestGain) { bestGain = gain; best = c; }
    }
    seedSet(save);
    return best;
  },

  // BECERIKLI INSAN VEKILI ("kor ileri gorus"): her adayi sonuna kadar simule
  // eder AMA degerlendirmeyi oyunun gercek rastgelelik akisindan AYRI bir
  // akisla yapar. Yani zincirleme sonuclarini planlar, fakat yukaridan hangi
  // sekerin dusecegini BILEMEZ -- tam olarak bir insanin durumu.
  // `ileri` politikasindan farki tek satir: degerlendirme tohumu bagimsiz.
  ilerikor(st, cands) {
    const save = seedGet();
    let best = cands[0], bestGain = -1;
    for (const c of cands) {
      // her aday ayni bagimsiz tohumla denenir -> adil karsilastirma,
      // ama bu tohum oyunun gercek akisi DEGIL.
      seedSet((save * 2654435761) ^ 0x5bf03635);
      const r = applyMove(st, c);
      const gain = r.score - st.score;
      if (gain > bestGain) { bestGain = gain; best = c; }
    }
    seedSet(save);
    return best;
  },
};

/* ---------- bir oyun ---------- */
function playGame(moveLimit, policyName) {
  const policy = POLICIES[policyName];
  let grid = createBoard();
  let guard = 0;
  while (findMatches(grid).matched.size > 0 && guard < 100) { grid = createBoard(); guard++; }
  let st = { grid, score: 0, charge: [0, 0, 0, 0, 0, 0], chainStreak: 0 };
  let moves = moveLimit;
  const agg = { specialsPlaced: 0, frenzyCount: 0, maxCascade: 0, bombSwaps: 0 };
  while (moves > 0) {
    const cands = candidateMoves(st.grid);
    if (cands.length === 0) { st = { ...st, grid: shuffleBoard(st.grid) }; continue; }
    const pick = policy(st, cands);
    const r = applyMove(st, pick);
    st = { grid: r.grid, score: r.score, charge: r.charge, chainStreak: r.chainStreak };
    agg.specialsPlaced += r.stats.specialsPlaced;
    agg.frenzyCount += r.stats.frenzyCount;
    agg.bombSwaps += r.stats.bombSwap;
    if (r.stats.maxCascade > agg.maxCascade) agg.maxCascade = r.stats.maxCascade;
    moves--;
  }
  return { score: st.score, ...agg };
}

/* ---------- istatistik ---------- */
function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}
export function dagilim(moveLimit, runs, policyName = 'acgozlu', seed = 12345) {
  seedSet(seed);
  const res = [];
  for (let i = 0; i < runs; i++) res.push(playGame(moveLimit, policyName));
  const sc = res.map(r => r.score).sort((a, b) => a - b);
  return {
    moves: moveLimit, runs, policy: policyName,
    min: sc[0], max: sc[sc.length - 1],
    p05: pct(sc, 0.05), p10: pct(sc, 0.10), p25: pct(sc, 0.25), p50: pct(sc, 0.50),
    p75: pct(sc, 0.75), p90: pct(sc, 0.90), p95: pct(sc, 0.95), p99: pct(sc, 0.99),
    ort: Math.round(sc.reduce((a, b) => a + b, 0) / sc.length),
    frenzy: +(res.reduce((a, b) => a + b.frenzyCount, 0) / runs).toFixed(2),
    ozel: +(res.reduce((a, b) => a + b.specialsPlaced, 0) / runs).toFixed(1),
    bomba: +(res.reduce((a, b) => a + b.bombSwaps, 0) / runs).toFixed(2),
    skorlar: sc,
  };
}

/* ---------- CLI ----------
 * Bu dosya qa/hedef_uret.mjs tarafindan IMPORT ediliyor; import edildiginde
 * CLI kosmamali. Sadece dogrudan `node qa/kalibrasyon.mjs` ile calistirilinca. */
const ENTRY = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('qa/kalibrasyon.mjs');
const mode = ENTRY ? (process.argv[2] || 'tablo') : 'kutuphane';
const RUNS = Number(process.argv[3] || 100);

if (mode === 'dagilim') {
  const list = (process.argv[4] || '10,12,15,18,20,22,25,28,30,35,40').split(',').map(Number);
  console.log('hamle | oyun |    p05 |    p25 |    p50 |    p75 |    p95 |    p99 |     ort | frenzy | ozel | bomba');
  for (const m of list) {
    const d = dagilim(m, RUNS, 'acgozlu');
    console.log('%s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s',
      String(m).padStart(5), String(RUNS).padStart(4),
      String(d.p05).padStart(6), String(d.p25).padStart(6), String(d.p50).padStart(6),
      String(d.p75).padStart(6), String(d.p95).padStart(6), String(d.p99).padStart(6),
      String(d.ort).padStart(7), String(d.frenzy).padStart(6), String(d.ozel).padStart(4),
      String(d.bomba).padStart(5));
  }
} else if (mode === 'politika') {
  const list = (process.argv[4] || '15,25,35').split(',').map(Number);
  console.log('politika  | hamle | oyun |    p25 |    p50 |    p75 |     ort | medyan orani (acgozlu=1.00)');
  for (const m of list) {
    const base = dagilim(m, RUNS, 'acgozlu').p50;
    for (const p of ['rastgele', 'acgozlu', 'ilerikor', 'ileri']) {
      const d = dagilim(m, RUNS, p);
      console.log('%s | %s | %s | %s | %s | %s | %s | %s',
        p.padEnd(9), String(m).padStart(5), String(RUNS).padStart(4),
        String(d.p25).padStart(6), String(d.p50).padStart(6), String(d.p75).padStart(6),
        String(d.ort).padStart(7), (d.p50 / base).toFixed(2));
    }
  }
} else if (mode === 'tablo') {
  // 4. argüman politika: acgozlu (varsayilan) | rastgele | ilerikor | ileri
  // 5. argüman tohum tabani -- hedef_uret.mjs'inkinden FARKLI verilirse olcum
  // bagimsiz ornek olur (hedefleri ureten orneğe overfit olmadigi gorulur).
  const POL = process.argv[4] || 'acgozlu';
  const SEED0 = Number(process.argv[5] || 1000);
  console.log('politika =', POL, '| oyun/seviye =', RUNS, '| tohum tabani =', SEED0);
  console.log('sev | hml |     t1 /     t2 /     t3 |    p50 | %>=t1 | %>=t2 | %>=t3');
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    const d = dagilim(lv.moves, RUNS, POL, SEED0 + i);
    const rate = (t) => (100 * d.skorlar.filter(s => s >= t).length / d.skorlar.length).toFixed(0);
    console.log('%s | %s | %s / %s / %s | %s | %s%% | %s%% | %s%%',
      String(i + 1).padStart(3), String(lv.moves).padStart(3),
      String(lv.target1).padStart(6), String(lv.target2).padStart(6), String(lv.target3).padStart(6),
      String(d.p50).padStart(6), rate(lv.target1).padStart(4), rate(lv.target2).padStart(4), rate(lv.target3).padStart(4));
  }
  console.log('FRENZY_CHARGE_TARGET =', FRENZY_CHARGE_TARGET);
}
