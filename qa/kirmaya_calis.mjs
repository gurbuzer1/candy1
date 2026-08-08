/**
 * KIRMAYA CALISMA PROBU — "duzeltme yeni bir sey bozdu mu?"
 * Sadece "bulgu kapandi mi" degil, kapatma bicimi ne kirdi diye bakar.
 *
 * 1) shuffleBoard SURESI  — 1 Fisher-Yates atisindan 80 denemeli reddetme
 *    dongusune cikti. Telefonda UI'yi dondurur mu? En kotu durum olculur.
 * 2) shuffleBoard COKLU KUME  — seker sayisi/ozel sekerler korunuyor mu,
 *    undefined hucre uretiyor mu (pool.length===0 break dali).
 * 3) OYNANAMAZ TAHTA  — shuffleBoard "temiz ama hamlesiz" tahta dondurur mu
 *    (GameScreen 3 denemeden sonra setBusy(false) yapip birakiyor -> kilit).
 * 4) SONSUZ ZINCIR  — getSpecialRemovals ozel sekerle DOLU tahtada donuyor mu.
 * 5) RENK BOMBASI ENGELI — bombali tahtada hasValidMoves her zaman true;
 *    peki bomba takasi gercekten ILERLEME saglıyor mu yoksa bos hamle mi?
 * 6) CASCADE DERINLIGI — ozel sekerler artik konduguna gore zincir ne kadar
 *    uzayabiliyor (GameScreen processCascade OZYINELEMELI).
 */
const ROOT = process.env.ENGINE
  || 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src';
const E = await import(`${ROOT}/engine/BoardEngine.js`);
const K = await import(`${ROOT}/constants/kural.js`);
const { COLS, ROWS, SPECIAL, CANDY_COUNT } = K;
const {
  createBoard, shuffleBoard, findMatches, hasValidMoves, getSpecialRemovals,
  swapCells, determineSpecials, reserveSpecials, removeAndCollapse, colorBombSwap,
  SHUFFLE_MAX_ATTEMPTS,
} = E;
const say = (...a) => console.log(...a);

// ---- 1 + 2 + 3: shuffleBoard
say('=== 1-3) shuffleBoard: SURE, COKLU KUME, OYNANABILIRLIK ===');
say('SHUFFLE_MAX_ATTEMPTS =', SHUFFLE_MAX_ATTEMPTS);
const N = Number(process.argv[2] || 300);
let sureler = [];
let kirli = 0, hamlesiz = 0, bozukHucre = 0, kumeBozuldu = 0, ozelKayboldu = 0;
for (let i = 0; i < N; i++) {
  let g = createBoard();
  // her 3. tahtada ozel seker serpistir (gercek oyunda tahtada ozel BULUNUR)
  if (i % 3 === 0) {
    for (let k = 0; k < 6; k++) {
      const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
      g[c][r] = { ...g[c][r], special: 1 + Math.floor(Math.random() * 4) };
    }
  }
  const oncekiTip = new Array(CANDY_COUNT).fill(0);
  let oncekiOzel = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    oncekiTip[g[c][r].type]++;
    if (g[c][r].special !== SPECIAL.NONE) oncekiOzel++;
  }

  const t0 = process.hrtime.bigint();
  const s = shuffleBoard(g);
  const t1 = process.hrtime.bigint();
  sureler.push(Number(t1 - t0) / 1e6);

  const sonraTip = new Array(CANDY_COUNT).fill(0);
  let sonraOzel = 0, bos = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const cell = s?.[c]?.[r];
    if (!cell) { bos++; continue; }
    sonraTip[cell.type]++;
    if (cell.special !== SPECIAL.NONE) sonraOzel++;
  }
  if (bos > 0) bozukHucre++;
  if (oncekiTip.join() !== sonraTip.join()) kumeBozuldu++;
  if (sonraOzel !== oncekiOzel) ozelKayboldu++;
  if (findMatches(s).matched.size > 0) kirli++;
  if (!hasValidMoves(s)) hamlesiz++;
}
sureler.sort((a, b) => a - b);
say(`  ${N} karistirma`);
say(`  sure ms: medyan ${sureler[Math.floor(N / 2)].toFixed(1)} | p95 ${sureler[Math.floor(N * 0.95)].toFixed(1)} | EN KOTU ${sureler[N - 1].toFixed(1)}`);
say(`  hazir eslesme birakan : ${kirli}`);
say(`  GECERLI HAMLESI OLMAYAN: ${hamlesiz}   <-- >0 ise GameScreen 3 denemeden sonra tahtayi KILITLI birakir`);
say(`  undefined hucre ureten : ${bozukHucre}`);
say(`  renk coklu kumesi bozulan: ${kumeBozuldu}`);
say(`  ozel seker sayisi degisen: ${ozelKayboldu}`);

// ---- 4: sonsuz zincir
say('\n=== 4) getSpecialRemovals: OZEL SEKERLE DOLU tahtada zincir doner mi? ===');
{
  const g = [];
  for (let c = 0; c < COLS; c++) {
    g[c] = [];
    for (let r = 0; r < ROWS; r++) {
      g[c][r] = { type: (c + r) % CANDY_COUNT, special: 1 + ((c + r) % 4), id: `f_${c}_${r}` };
    }
  }
  const t0 = Date.now();
  const ex = getSpecialRemovals(g, new Set(['0,0']));
  const dt = Date.now() - t0;
  say(`  81/81 hucre ozel -> silinen ${ex.size} hucre, ${dt} ms (donmediyse OK)`);
}

// ---- 5: renk bombasi bos hamle mi?
say('\n=== 5) RENK BOMBASI takasi ILERLEME saglıyor mu, yoksa bos hamle mi? ===');
{
  let bosHamle = 0, deneme = 0, ortSilinen = 0;
  for (let i = 0; i < 200; i++) {
    let g = createBoard();
    const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
    g[c][r] = { ...g[c][r], special: SPECIAL.COLOR_BOMB };
    const c2 = c < COLS - 1 ? c + 1 : c - 1;
    const s = swapCells(g, c, r, c2, r);
    const blast = colorBombSwap(s, c, r, c2, r);
    deneme++;
    if (!blast || blast.size <= 2) bosHamle++;
    ortSilinen += blast ? blast.size : 0;
  }
  say(`  ${deneme} bomba takasi -> ort. silinen ${(ortSilinen / deneme).toFixed(1)} hucre | 2 hucreden az silen (BOS HAMLE): ${bosHamle}`);
}

// ---- 6: cascade derinligi
say('\n=== 6) CASCADE DERINLIGI (processCascade OZYINELEMELI — yigin riski) ===');
{
  let enDerin = 0, toplam = 0, oyun = 0;
  for (let i = 0; i < 40; i++) {
    let grid = createBoard();
    for (let m = 0; m < 25; m++) {
      // en iyi takasi bul
      let best = null, bestV = -1;
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const c2 = c + dc, r2 = r + dr;
          if (c2 >= COLS || r2 >= ROWS) continue;
          const s = swapCells(grid, c, r, c2, r2);
          const { matched } = findMatches(s);
          if (matched.size === 0) continue;
          if (matched.size > bestV) { bestV = matched.size; best = [c, r, c2, r2]; }
        }
      }
      if (!best) { grid = shuffleBoard(grid); continue; }
      grid = swapCells(grid, ...best);
      let lvl = 0;
      for (;;) {
        const { matched, matchGroups } = findMatches(grid);
        if (matched.size === 0) break;
        const sp = determineSpecials(matchGroups);
        getSpecialRemovals(grid, matched).forEach((k) => matched.add(k));
        const res = sp.length > 0 ? reserveSpecials(grid, matched, sp) : { grid, matched, placed: [] };
        grid = removeAndCollapse(res.grid, res.matched).grid;
        lvl++;
        if (lvl > 300) throw new Error('cascade 300 seviyeyi asti -- SONSUZ');
      }
      if (lvl > enDerin) enDerin = lvl;
      toplam += lvl; oyun++;
    }
  }
  say(`  40 oyun x 25 hamle -> ort. cascade derinligi ${(toplam / oyun).toFixed(2)} | EN DERIN ${enDerin}`);
  say('  (GameScreen processCascade her seviyede kendini await ile cagiriyor;');
  say('   derinlik makul kaldigi surece yigin/gecikme sorunu yok)');
}
