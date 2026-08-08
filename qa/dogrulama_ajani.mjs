/**
 * BAGIMSIZ DOGRULAMA PROBU (duzeltme ajanindan AYRI yazildi).
 *
 * Amac: "ozel seker tahtaya konuyor / renk bombasi patliyor / frenzy kazanilan
 * bir odul" iddialarini KENDI olcumumle sinamak.
 *
 * FARKLAR (autoplay2.mjs'ten kasten ayrildi):
 *   - LUCKY DROP KAPALI. Boylece tahtada gorulen HER ozel seker ya eslesmeden
 *     ya zincir bonusundan ya frenzy'den gelir; %4'luk sans dususu olcumu
 *     kirletemez. (autoplay2 lucky drop'u aciyor -> "tahtada ozel var" demesi
 *     tek basina bulgu 1'i kanitlamaz.)
 *   - ZINCIR BONUSU da KAPALI (CHAIN_BONUS kapatildi) -> geriye SADECE
 *     eslesmeden dogan ozel kalir. En dar olcum budur.
 *   - TAHTA SAYIMI: her hamlenin sonunda tahtadaki ozel seker sayilir
 *     ("kare sayisi degil karenin icerigi"): sayac degil, TAHTA olculur.
 *
 * MOTOR YOLU DISARIDAN VERILEBILIR:  ENGINE=<src klasoru file:/// URL'i>
 * Boylece ayni prob, KASTEN BOZULMUS bir kopyada da kosturulup gercekten
 * AYIRT EDIP EDEMEDIGI gosterilebilir (kalibrasyon).
 */
const ROOT = process.env.ENGINE
  || 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src';

const E = await import(`${ROOT}/engine/BoardEngine.js`);
const K = await import(`${ROOT}/constants/kural.js`);
const EC = await import(`${ROOT}/constants/economy.js`);
const LV = await import(`${ROOT}/constants/levels.js`);

const { COLS, ROWS, SPECIAL, CANDY_COUNT } = K;
const {
  createBoard, swapCells, findMatches, determineSpecials, getSpecialRemovals,
  removeAndCollapse, reserveSpecials, colorBombSwap, calculateScore,
  hasValidMoves, shuffleBoard,
} = E;

const say = (...a) => console.log(...a);

// ---------------------------------------------------------------- yardimcilar
function bosTahta(fn) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    g[c] = [];
    for (let r = 0; r < ROWS; r++) {
      g[c][r] = { type: fn(c, r), special: SPECIAL.NONE, id: `t_${c}_${r}` };
    }
  }
  return g;
}
/** Eslesme URETMEYEN dolgu: 6 renk, satir/sutun kaydirmali sablon. */
const dolgu = (c, r) => (c + 2 * r) % CANDY_COUNT;

function ozelSay(g) {
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) if (g[c][r] && g[c][r].special !== SPECIAL.NONE) n++;
  }
  return n;
}
function tipSay(g, t) {
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) if (g[c][r] && g[c][r].type === t) n++;
  }
  return n;
}

// ============================================================ A) TEK HAMLE
// 4'lu eslesme kuran bir takas -> cascade bitince tahtada CIZGILI var mi?
function A_dortluTakas() {
  say('\n=== A) 4-LU ESLESME -> TAHTADA CIZGILI KALIYOR MU? (deterministik) ===');
  // Satir 4: cols 0,1 = tip5 | col2 = FARKLI | col3 = tip5 | (2,5) = tip5.
  // Takas (2,4)<->(2,5) satiri 5,5,5,5 yapar. Takas ONCESI eslesme YOK
  // (yan yana en fazla iki tane) -- olcum kendi kurdugu eslesmeyi saymasin.
  const g = bosTahta(dolgu);
  [0, 1, 3].forEach((c) => { g[c][4] = { type: 5, special: 0, id: `a_${c}` }; });
  g[2][4] = { type: 1, special: 0, id: 'a_x' };
  g[2][5] = { type: 5, special: 0, id: 'a_y' };
  // takas oncesi tahtada hazir eslesme olmamali
  const oncesi = findMatches(g).matched.size;

  const s = swapCells(g, 2, 4, 2, 5);
  const { matched, matchGroups } = findMatches(s);
  const grup = matchGroups.map((x) => `${x.direction}:${x.cells.length}`).join(',');
  const specials = determineSpecials(matchGroups);
  getSpecialRemovals(s, matched).forEach((k) => matched.add(k));
  const res = specials.length > 0
    ? reserveSpecials(s, matched, specials)
    : { grid: s, matched, placed: [] };
  const { grid: collapsed } = removeAndCollapse(res.grid, res.matched);

  say(`  takas ONCESI hazir eslesme: ${oncesi} (0 olmali)`);
  say(`  eslesme gruplari: ${grup}`);
  say(`  determineSpecials -> ${JSON.stringify(specials)}`);
  say(`  reserveSpecials placed = ${res.placed.length} | silinecek kume ${matched.size} -> ${res.matched.size}`);
  say(`  COLLAPSE SONRASI tahtadaki ozel seker: ${ozelSay(collapsed)}`);
  const hedef = specials[0];
  if (hedef) {
    const h = collapsed[hedef.col][hedef.row];
    say(`  hedef hucre (${hedef.col},${hedef.row}) -> special=${h?.special} tip=${h?.type}`);
  }
  return { placed: res.placed.length, boardSpecials: ozelSay(collapsed) };
}

// ============================================================ B) RENK BOMBASI
function B_renkBombasi() {
  say('\n=== B) RENK BOMBASI: TAKASLA PATLIYOR MU? (kontrol grubu ile) ===');
  const kur = (bombaVarMi) => {
    const g = bosTahta(dolgu);
    g[0][0] = { type: 0, special: bombaVarMi ? SPECIAL.COLOR_BOMB : SPECIAL.NONE, id: 'b0' };
    g[1][0] = { type: 3, special: SPECIAL.NONE, id: 'b1' };
    return g;
  };
  const gB = kur(true);
  const hedefTip = gB[1][0].type;
  const kacTane = tipSay(gB, hedefTip);
  const sB = swapCells(gB, 0, 0, 1, 0);
  const blastB = colorBombSwap(sB, 0, 0, 1, 0);

  const gK = kur(false);                       // KONTROL: ayni tahta, bomba YOK
  const sK = swapCells(gK, 0, 0, 1, 0);
  const blastK = colorBombSwap(sK, 0, 0, 1, 0);

  say(`  BOMBALI  : tahtada tip ${hedefTip} sayisi = ${kacTane} -> silinen = ${blastB ? blastB.size : 'null'}`);
  say(`  KONTROL  : ayni takas, bomba YOK        -> silinen = ${blastK === null ? 'null (DOGRU)' : blastK.size + ' (YANLIS!)'}`);

  // bomba + bomba
  const g2 = bosTahta(dolgu);
  g2[0][0] = { type: 0, special: SPECIAL.COLOR_BOMB, id: 'x0' };
  g2[1][0] = { type: 1, special: SPECIAL.COLOR_BOMB, id: 'x1' };
  const blast2 = colorBombSwap(swapCells(g2, 0, 0, 1, 0), 0, 0, 1, 0);
  say(`  bomba+bomba -> silinen = ${blast2 ? blast2.size : 'null'} (${COLS * ROWS} bekleniyor)`);

  // zincir: baska bir patlamanin icinde kalan bomba
  const g3 = bosTahta(dolgu);
  g3[4][4] = { type: 0, special: SPECIAL.STRIPED_H, id: 'z0' };
  g3[7][4] = { type: 2, special: SPECIAL.COLOR_BOMB, id: 'z1' };
  const m3 = new Set(['4,4']);
  const ex3 = getSpecialRemovals(g3, m3);
  let satirDisi = 0;
  ex3.forEach((k) => { if (Number(k.split(',')[1]) !== 4) satirDisi++; });
  say(`  zincir: cizgili patlar, icindeki bomba da patlar mi -> satir 4 DISI silinen = ${satirDisi} (0 ise bomba olu)`);

  return {
    bombali: blastB ? blastB.size : 0,
    kontrol: blastK === null,
    bombaBomba: blast2 ? blast2.size : 0,
    zincir: satirDisi,
  };
}

// ============================================================ C) TAM OYUN
// GameScreen.processCascade akisi; LUCKY DROP ve ZINCIR BONUSU KAPALI.
function oyunOyna(levelIdx, rng) {
  const lv = LV.LEVELS[levelIdx];
  let grid = createBoard();
  let guard = 0;
  while (findMatches(grid).matched.size > 0 && guard++ < 200) grid = createBoard();

  let moves = lv.moves;
  let score = 0;
  let charge = new Array(CANDY_COUNT).fill(0);
  let frenzyFired = false;
  let sayac = {
    eslesmedenKonanOzel: 0, frenzy: 0, bombaTakas: 0, bombaSilinen: 0,
    hamleSonuTahtaOzelToplam: 0, hamle: 0, kirliTahta: 0, maxOzelAyniAnda: 0,
  };

  function frenzyRenk(ch) { return EC.frenzyReadyColor(ch); }

  function cascade(g) {
    let cur = g, lvl = 0, sd = 0, adim = 0;
    for (;;) {
      if (adim++ > 500) { throw new Error('cascade 500 adimda bitmedi -- SONSUZ DONGU'); }
      const { matched, matchGroups } = findMatches(cur);
      if (matched.size === 0) {
        if (!frenzyFired) {
          const t = frenzyRenk(charge);
          if (t >= 0) {
            const cells = [];
            for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
              const cd = cur[c][r];
              if (cd && cd.special === SPECIAL.NONE && cd.type === t) cells.push({ col: c, row: r });
            }
            if (cells.length > 0) {
              frenzyFired = true; sayac.frenzy++;
              charge = new Array(CANDY_COUNT).fill(0);
              const conv = cur.map((c) => c.slice());
              cells.forEach(({ col, row }) => {
                conv[col][row] = { ...conv[col][row], special: rng() < 0.5 ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V };
              });
              const fm = new Set(cells.map(({ col, row }) => `${col},${row}`));
              getSpecialRemovals(conv, fm).forEach((k) => fm.add(k));
              score += cells.length * 80 + fm.size * 60;
              cur = removeAndCollapse(conv, fm).grid;   // lucky drop YOK
              lvl = 0;
              continue;
            }
          }
        }
        if (!hasValidMoves(cur)) {
          if (sd < 3) { cur = shuffleBoard(cur); sd++; lvl = 0; continue; }
          return cur;
        }
        return cur;
      }
      const specials = determineSpecials(matchGroups);
      getSpecialRemovals(cur, matched).forEach((k) => matched.add(k));
      const res = specials.length > 0
        ? reserveSpecials(cur, matched, specials)
        : { grid: cur, matched, placed: [] };
      sayac.eslesmedenKonanOzel += res.placed.length;
      res.matched.forEach((key) => {
        const [c, r] = key.split(',').map(Number);
        const cell = cur[c]?.[r];
        if (cell && cell.type >= 0 && cell.type < CANDY_COUNT) charge[cell.type] += 1;
      });
      score += calculateScore(matchGroups, specials, lvl);
      cur = removeAndCollapse(res.grid, res.matched).grid;   // lucky drop YOK
      lvl++;
    }
  }

  function enIyiTakas(g) {
    let best = null, bestV = -1, bestBomb = null;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 >= COLS || r2 >= ROWS) continue;
        const s = swapCells(g, c, r, c2, r2);
        const bomb = colorBombSwap(s, c, r, c2, r2);
        const { matched, matchGroups } = findMatches(s);
        if (matched.size === 0 && !bomb) continue;
        let v;
        if (bomb) v = bomb.size + 20;
        else {
          const sp = determineSpecials(matchGroups);
          v = matched.size + getSpecialRemovals(s, matched).size + sp.length * 5;
        }
        if (v > bestV) { bestV = v; best = [c, r, c2, r2]; bestBomb = bomb; }
      }
    }
    return best ? { mv: best, bomb: bestBomb } : null;
  }

  while (moves > 0) {
    const pick = enIyiTakas(grid);
    if (!pick) { grid = shuffleBoard(grid); continue; }
    frenzyFired = false;
    grid = swapCells(grid, ...pick.mv);
    moves--;
    sayac.hamle++;
    if (pick.bomb) {
      sayac.bombaTakas++;
      const all = new Set(pick.bomb);
      getSpecialRemovals(grid, all).forEach((k) => all.add(k));
      sayac.bombaSilinen += all.size;
      all.forEach((key) => {
        const [c, r] = key.split(',').map(Number);
        const cell = grid[c]?.[r];
        if (cell && cell.type >= 0 && cell.type < CANDY_COUNT) charge[cell.type] += 1;
      });
      score += all.size * 60;
      grid = removeAndCollapse(grid, all).grid;
    }
    grid = cascade(grid);
    const o = ozelSay(grid);
    sayac.hamleSonuTahtaOzelToplam += o;
    if (o > sayac.maxOzelAyniAnda) sayac.maxOzelAyniAnda = o;
    if (findMatches(grid).matched.size > 0) sayac.kirliTahta++;
  }
  return { score, ...sayac, lv };
}

function C_tamOyun(seviyeler, tekrar) {
  say(`\n=== C) TAM OYUN (lucky drop KAPALI, zincir bonusu KAPALI) — ${tekrar} oyun/seviye ===`);
  say('sev | hml | t1/t2/t3 | ort.skor | %t1 | %t2 | %t3 | eslesmeden ozel/oyun | frenzy/oyun | frenzy/hamle | bombaTakas/oyun | TAHTADA ort.ozel | kirli');
  const cikti = [];
  for (const num of seviyeler) {
    const res = [];
    for (let i = 0; i < tekrar; i++) res.push(oyunOyna(num - 1, Math.random));
    const lv = res[0].lv;
    const ort = (k) => res.reduce((a, b) => a + b[k], 0) / res.length;
    const pct = (t) => (100 * res.filter((r) => r.score >= t).length / res.length).toFixed(0);
    const tahtaOrt = ort('hamleSonuTahtaOzelToplam') / ort('hamle');
    const satir = [
      String(num).padStart(2), String(lv.moves).padStart(3),
      `${lv.target1}/${lv.target2}/${lv.target3}`,
      String(Math.round(ort('score'))).padStart(7),
      `${pct(lv.target1)}%`, `${pct(lv.target2)}%`, `${pct(lv.target3)}%`,
      ort('eslesmedenKonanOzel').toFixed(1),
      ort('frenzy').toFixed(2),
      (ort('frenzy') / ort('hamle')).toFixed(3),
      ort('bombaTakas').toFixed(2),
      tahtaOrt.toFixed(2),
      String(res.reduce((a, b) => a + b.kirliTahta, 0)),
    ].join(' | ');
    say(satir);
    cikti.push({ num, ...Object.fromEntries(['score', 'eslesmedenKonanOzel', 'frenzy', 'bombaTakas', 'hamle'].map((k) => [k, ort(k)])), tahtaOrt });
  }
  return cikti;
}

// ---------------------------------------------------------------------- kosum
say('MOTOR YOLU:', ROOT);
say('FRENZY_CHARGE_TARGET =', EC.FRENZY_CHARGE_TARGET, '| FRENZY_THRESHOLD (eski) =', EC.FRENZY_THRESHOLD);
const a = A_dortluTakas();
const b = B_renkBombasi();
const seviyeler = (process.argv[2] || '1,15,30').split(',').map(Number);
const tekrar = Number(process.argv[3] || 20);
const c = C_tamOyun(seviyeler, tekrar);

say('\n=== OZET (makine okunur) ===');
say(JSON.stringify({ A: a, B: b, C: c }, null, 1));
