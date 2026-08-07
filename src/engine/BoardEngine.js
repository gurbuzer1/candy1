import { COLS, ROWS, CANDY_COUNT, SPECIAL, SCORE_VALUES } from '../constants/kural.js';

// Pure game logic — no React, no animations. Just the grid state machine.

export function createBoard() {
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    grid[c] = [];
    for (let r = 0; r < ROWS; r++) {
      let type;
      do {
        type = Math.floor(Math.random() * CANDY_COUNT);
      } while (wouldMatch(grid, c, r, type));
      grid[c][r] = { type, special: SPECIAL.NONE, id: cellId(c, r) };
    }
  }
  return grid;
}

let idCounter = 0;
function cellId(c, r) {
  return `candy_${c}_${r}_${idCounter++}`;
}

function wouldMatch(grid, col, row, type) {
  if (col >= 2) {
    const l1 = grid[col - 1]?.[row];
    const l2 = grid[col - 2]?.[row];
    if (l1 && l2 && l1.type === type && l2.type === type) return true;
  }
  if (row >= 2) {
    const u1 = grid[col]?.[row - 1];
    const u2 = grid[col]?.[row - 2];
    if (u1 && u2 && u1.type === type && u2.type === type) return true;
  }
  return false;
}

export function swapCells(grid, c1, r1, c2, r2) {
  const newGrid = grid.map(col => [...col]);
  const temp = newGrid[c1][r1];
  newGrid[c1][r1] = newGrid[c2][r2];
  newGrid[c2][r2] = temp;
  return newGrid;
}

export function findMatches(grid) {
  const matched = new Set();
  const matchGroups = [];

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let start = 0;
    for (let c = 1; c <= COLS; c++) {
      const curr = grid[c]?.[r];
      const prev = grid[c - 1]?.[r];
      if (curr && prev && curr.type === prev.type &&
          curr.special !== SPECIAL.COLOR_BOMB && prev.special !== SPECIAL.COLOR_BOMB) {
        continue;
      }
      if (c - start >= 3) {
        const group = [];
        for (let mc = start; mc < c; mc++) {
          matched.add(`${mc},${r}`);
          group.push({ col: mc, row: r });
        }
        matchGroups.push({
          cells: group,
          type: grid[start][r].type,
          direction: 'horizontal',
        });
      }
      start = c;
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    let start = 0;
    for (let r = 1; r <= ROWS; r++) {
      const curr = grid[c]?.[r];
      const prev = grid[c]?.[r - 1];
      if (curr && prev && curr.type === prev.type &&
          curr.special !== SPECIAL.COLOR_BOMB && prev.special !== SPECIAL.COLOR_BOMB) {
        continue;
      }
      if (r - start >= 3) {
        const group = [];
        for (let mr = start; mr < r; mr++) {
          matched.add(`${c},${mr}`);
          group.push({ col: c, row: mr });
        }
        matchGroups.push({
          cells: group,
          type: grid[c][start].type,
          direction: 'vertical',
        });
      }
      start = r;
    }
  }

  return { matched, matchGroups };
}

export function determineSpecials(matchGroups) {
  const specials = [];
  const processed = new Set();
  const usedGroups = new Set();

  // ÖNCELİK 1 — 5+ dizi → RENK BOMBASI.
  // Bu dal eskiden L/T dalindan SONRA kosuyordu; bir 5'li baska bir eslesmeyle
  // kesistiginde L/T dali once davranip 5'linin hucrelerini `processed`e
  // yaziyor ve oyuncuya renk bombasi yerine SARMAL veriyordu (bulgu 7).
  // Match-3 standardi: 5 > L/T > 4.
  matchGroups.forEach((group, gi) => {
    if (group.cells.length < 5) return;
    const center = group.cells[Math.floor(group.cells.length / 2)];
    const key = `${center.col},${center.row}`;
    if (processed.has(key)) return;
    specials.push({
      col: center.col, row: center.row,
      type: group.type, special: SPECIAL.COLOR_BOMB,
    });
    processed.add(key);
    usedGroups.add(gi);
    group.cells.forEach(cell => processed.add(`${cell.col},${cell.row}`));
  });

  // ÖNCELİK 2 — L/T intersections → wrapped
  for (let i = 0; i < matchGroups.length; i++) {
    if (usedGroups.has(i)) continue;
    for (let j = i + 1; j < matchGroups.length; j++) {
      if (usedGroups.has(j)) continue;
      if (matchGroups[i].type !== matchGroups[j].type) continue;
      const intersection = matchGroups[i].cells.find(a =>
        matchGroups[j].cells.some(b => a.col === b.col && a.row === b.row)
      );
      if (intersection) {
        const key = `${intersection.col},${intersection.row}`;
        if (!processed.has(key)) {
          specials.push({
            col: intersection.col,
            row: intersection.row,
            type: matchGroups[i].type,
            special: SPECIAL.WRAPPED,
          });
          processed.add(key);
          [...matchGroups[i].cells, ...matchGroups[j].cells].forEach(
            cell => processed.add(`${cell.col},${cell.row}`)
          );
        }
      }
    }
  }

  // ÖNCELİK 3 — 4 → striped.
  // (5+ dali yukari, L/T'den ONCE tasindi; asagidaki >= 5 kolu yalnizca
  // yukarida hicbir sebeple islenememis 5'liler icin yedek olarak duruyor.)
  matchGroups.forEach(group => {
    if (group.cells.every(c => processed.has(`${c.col},${c.row}`))) return;

    if (group.cells.length >= 5) {
      const center = group.cells[Math.floor(group.cells.length / 2)];
      const key = `${center.col},${center.row}`;
      if (!processed.has(key)) {
        specials.push({
          col: center.col, row: center.row,
          type: group.type, special: SPECIAL.COLOR_BOMB,
        });
        processed.add(key);
      }
    } else if (group.cells.length === 4) {
      const center = group.cells[1];
      const key = `${center.col},${center.row}`;
      if (!processed.has(key)) {
        specials.push({
          col: center.col, row: center.row,
          type: group.type,
          special: group.direction === 'horizontal' ? SPECIAL.STRIPED_V : SPECIAL.STRIPED_H,
        });
        processed.add(key);
      }
    }
  });

  return specials;
}

export function getSpecialRemovals(grid, matched) {
  const extra = new Set();

  // ZINCIRLEME PATLAMA (bulgu 6):
  // Eskiden bu fonksiyon yalnizca `matched` kumesindeki hucreleri BIR KEZ
  // tariyordu. Bir cizgili sekerin patlattigi satirin icinde kalan baska bir
  // ozel seker tetiklenmeden siliniyordu. Artik is listesi (queue) ile
  // calisiyor: patlamanin icine giren her ozel seker de kendi patlamasini
  // ekliyor. `seen` sayesinde ayni hucre iki kez tetiklenemez -> sonsuz dongu
  // yok, en fazla COLS*ROWS adim.
  const seen = new Set();
  const all = new Set(matched);   // silinecegi kesinlesmis her hucre
  const queue = [...matched];

  while (queue.length > 0) {
    const key = queue.shift();
    if (seen.has(key)) continue;
    seen.add(key);

    const [c, r] = key.split(',').map(Number);
    const candy = grid[c]?.[r];
    if (!candy) continue;

    const hit = [];   // bu sekerin patlattigi hucreler

    if (candy.special === SPECIAL.STRIPED_H) {
      for (let col = 0; col < COLS; col++) hit.push(`${col},${r}`);
    } else if (candy.special === SPECIAL.STRIPED_V) {
      for (let row = 0; row < ROWS; row++) hit.push(`${c},${row}`);
    } else if (candy.special === SPECIAL.WRAPPED) {
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const nc = c + dc, nr = r + dr;
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
            hit.push(`${nc},${nr}`);
          }
        }
      }
    } else if (candy.special === SPECIAL.COLOR_BOMB) {
      // Bulgu 3: bu dal eskiden ULASILMAZDI. findMatches renk bombasini her
      // diziden disliyor (dogru davranis: bombanin rengi yok), dolayisiyla
      // bomba `matched` icine hic giremiyordu. Artik iki yol var:
      //   a) takasla aktivasyon -> colorBombSwap()
      //   b) baska bir patlamanin icinde kalmak -> asagidaki zincir
      let targetType = -1;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dc, dr]) => {
        const n = grid[c + dc]?.[r + dr];
        if (n && all.has(`${c + dc},${r + dr}`) && targetType === -1) {
          targetType = n.type;
        }
      });
      if (targetType === -1) targetType = Math.floor(Math.random() * CANDY_COUNT);
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          if (grid[col][row]?.type === targetType) hit.push(`${col},${row}`);
        }
      }
    }

    hit.forEach(k => {
      extra.add(k);
      if (!all.has(k)) {
        all.add(k);
        queue.push(k);
      }
    });
  }

  return extra;
}

/**
 * TAKAS ILE RENK BOMBASI AKTIVASYONU (bulgu 3).
 * `grid` takas SONRASI tahtadir; (c1,r1) ve (c2,r2) takas edilen iki hucredir.
 * Iki hucreden en az biri COLOR_BOMB ise silinecek hucre kumesini doner,
 * degilse null. Bomba + duz seker -> o rengin TAMAMI. Bomba + bomba -> tahta.
 * null donmesi "bu takas bombayi aktive etmiyor" demektir.
 */
export function colorBombSwap(grid, c1, r1, c2, r2) {
  const a = grid[c1]?.[r1];
  const b = grid[c2]?.[r2];
  if (!a || !b) return null;

  const aBomb = a.special === SPECIAL.COLOR_BOMB;
  const bBomb = b.special === SPECIAL.COLOR_BOMB;
  if (!aBomb && !bBomb) return null;

  const removals = new Set([`${c1},${r1}`, `${c2},${r2}`]);

  if (aBomb && bBomb) {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) removals.add(`${c},${r}`);
    }
    return removals;
  }

  const other = aBomb ? b : a;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[c][r]?.type === other.type) removals.add(`${c},${r}`);
    }
  }
  return removals;
}

/** Bir takas oyuncu icin ANLAMLI mi: ya eslesme uretir ya renk bombasi patlatir. */
export function isPlayableSwap(grid, c1, r1, c2, r2) {
  const swapped = swapCells(grid, c1, r1, c2, r2);
  if (findMatches(swapped).matched.size > 0) return true;
  if (colorBombSwap(swapped, c1, r1, c2, r2)) return true;
  return false;
}

/**
 * OZEL SEKERI TAHTAYA YAZ (bulgu 1).
 * Eskiden `placeSpecials` collapse'tan SONRA cagriliyor ve yalnizca
 * `=== null` hucreye yaziyordu; collapse tum bosluklari doldurdugu icin kosul
 * ASLA saglanmiyordu -> 4'lu/5'li/L eslesmeden dogan ozel seker tahtaya hic
 * konmuyordu. Cozum: hucreyi silinecekler kumesinden CIKAR ve YERINDE ozele
 * cevir; boylece yercekimi onun etrafinda calisir ve seker tahtada kalir.
 * Doner: { grid, matched (kucultulmus), placed }
 */
export function reserveSpecials(grid, matched, specials) {
  const newGrid = grid.map(col => [...col]);
  const remaining = new Set(matched);
  const placed = [];

  specials.forEach(spec => {
    const key = `${spec.col},${spec.row}`;
    if (!remaining.has(key)) return;   // bu hucre zaten silinmiyor
    remaining.delete(key);
    newGrid[spec.col][spec.row] = {
      type: spec.type,
      special: spec.special,
      id: cellId(spec.col, spec.row),
    };
    placed.push(spec);
  });

  return { grid: newGrid, matched: remaining, placed };
}

export function removeAndCollapse(grid, matched) {
  const newGrid = grid.map(col => [...col]);

  // Nullify matched
  matched.forEach(key => {
    const [c, r] = key.split(',').map(Number);
    newGrid[c][r] = null;
  });

  // Gravity: collapse each column
  const fallMap = []; // { col, fromRow, toRow, candy }
  for (let c = 0; c < COLS; c++) {
    let writePos = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (newGrid[c][r]) {
        if (r !== writePos) {
          fallMap.push({ col: c, fromRow: r, toRow: writePos, candy: newGrid[c][r] });
          newGrid[c][writePos] = newGrid[c][r];
          newGrid[c][r] = null;
        }
        writePos--;
      }
    }

    // Fill empty from top
    for (let r = writePos; r >= 0; r--) {
      const type = Math.floor(Math.random() * CANDY_COUNT);
      const candy = { type, special: SPECIAL.NONE, id: cellId(c, r) };
      newGrid[c][r] = candy;
      fallMap.push({ col: c, fromRow: r - (writePos - r + 1), toRow: r, candy, isNew: true });
    }
  }

  return { grid: newGrid, fallMap };
}

/**
 * ⚠️ OLU KAPI (bulgu 1) — ARTIK CAGRILMIYOR, silinmedi.
 * `newGrid[col][row] === null` kosulu collapse'tan sonra ASLA saglanmiyordu.
 * Yerine `reserveSpecials` kullaniliyor. Fonksiyon geriye donuk uyumluluk ve
 * eski QA probe'lari (qa/probe1.mjs, qa/autoplay.mjs) icin duruyor.
 */
export function placeSpecials(grid, specials) {
  const newGrid = grid.map(col => [...col]);
  specials.forEach(spec => {
    if (newGrid[spec.col][spec.row] === null) {
      newGrid[spec.col][spec.row] = {
        type: spec.type,
        special: spec.special,
        id: cellId(spec.col, spec.row),
      };
    }
  });
  return newGrid;
}

export function calculateScore(matchGroups, specials, cascadeLevel) {
  let base = 0;
  matchGroups.forEach(group => {
    if (group.cells.length >= 5) base += SCORE_VALUES.MATCH_5;
    else if (group.cells.length === 4) base += SCORE_VALUES.MATCH_4;
    else base += SCORE_VALUES.MATCH_3;
  });
  specials.forEach(spec => {
    if (spec.special === SPECIAL.STRIPED_H || spec.special === SPECIAL.STRIPED_V) {
      base += SCORE_VALUES.SPECIAL_STRIPED;
    } else if (spec.special === SPECIAL.WRAPPED) {
      base += SCORE_VALUES.SPECIAL_WRAPPED;
    } else if (spec.special === SPECIAL.COLOR_BOMB) {
      base += SCORE_VALUES.SPECIAL_COLOR_BOMB;
    }
  });
  const multiplier = Math.pow(SCORE_VALUES.CASCADE_MULTIPLIER, cascadeLevel);
  return Math.floor(base * multiplier);
}

export function hasValidMoves(grid) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      // Swap right — renk bombasi takasi da GECERLI hamledir (bulgu 3).
      if (c < COLS - 1 && isPlayableSwap(grid, c, r, c + 1, r)) return true;
      // Swap down
      if (r < ROWS - 1 && isPlayableSwap(grid, c, r, c, r + 1)) return true;
    }
  }
  return false;
}

export function findHint(grid) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1 && isPlayableSwap(grid, c, r, c + 1, r)) return { col: c, row: r };
      if (r < ROWS - 1 && isPlayableSwap(grid, c, r, c, r + 1)) return { col: c, row: r };
    }
  }
  return null;
}

/**
 * KARISTIRMA (bulgu 4).
 * Eski surum tek bir Fisher-Yates atisi yapiyordu; sonucta %95 ihtimalle
 * tahtada patlamamis HAZIR eslesme kaliyordu (ort. 9.5 hucre). Bu hem bedava
 * puan hem de "her takas gecerli sayiliyor" hatasinin kaynagiydi.
 * Artik: eslesmesiz VE oynanabilir bir dizilim bulunana kadar tekrar atiyor.
 */
export const SHUFFLE_MAX_ATTEMPTS = 80;

export function shuffleBoard(grid) {
  const candies = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[c][r]) candies.push(grid[c][r]);
    }
  }

  // NEDEN "karistir, bak, tekrar dene" DEGIL: 9x9'da 126 ucluk pencere var ve
  // her biri ~1/36 ihtimalle ayni renk -> rastgele bir permutasyonun TEMIZ
  // cikma ihtimali sadece ~%3. Olculdu: 80 denemeli reddetme yontemi bile
  // 300 karistirmanin 12'sinde (%4) kirli tahta birakiyordu. Bunun yerine
  // createBoard ile ayni YAPICI yontem: her hucreye, o an eslesme URETMEYEN
  // bir seker yerlestir. Seker COKLU KUMESI aynen korunur (ozel sekerler dahil).
  function build() {
    const pool = candies.slice();
    // Fisher-Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const newGrid = [];
    for (let c = 0; c < COLS; c++) newGrid[c] = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (pool.length === 0) break;
        // Yanliligi azaltmak icin havuzu rastgele bir yerden taramaya basla.
        const start = Math.floor(Math.random() * pool.length);
        let pick = -1;
        for (let k = 0; k < pool.length; k++) {
          const i = (start + k) % pool.length;
          if (!wouldMatch(newGrid, c, r, pool[i].type)) { pick = i; break; }
        }
        if (pick < 0) pick = start;   // caresiz kalinirsa herhangi biri
        newGrid[c][r] = pool.splice(pick, 1)[0];
      }
    }
    return newGrid;
  }

  let cleanFallback = null;
  let last = null;

  for (let attempt = 0; attempt < SHUFFLE_MAX_ATTEMPTS; attempt++) {
    const g = build();
    last = g;
    if (findMatches(g).matched.size > 0) continue;   // hazir eslesme = bedava puan
    if (hasValidMoves(g)) return g;                  // ideal: temiz VE oynanabilir
    if (!cleanFallback) cleanFallback = g;           // en azindan temiz
  }

  // Cikilamadi: temiz olani, o da yoksa son atisi ver (hicbir zaman null donme).
  return cleanFallback || last;
}
