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

  // L/T intersections → wrapped
  for (let i = 0; i < matchGroups.length; i++) {
    for (let j = i + 1; j < matchGroups.length; j++) {
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

  // 5+ → color bomb, 4 → striped
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

  matched.forEach(key => {
    const [c, r] = key.split(',').map(Number);
    const candy = grid[c]?.[r];
    if (!candy) return;

    if (candy.special === SPECIAL.STRIPED_H) {
      for (let col = 0; col < COLS; col++) extra.add(`${col},${r}`);
    } else if (candy.special === SPECIAL.STRIPED_V) {
      for (let row = 0; row < ROWS; row++) extra.add(`${c},${row}`);
    } else if (candy.special === SPECIAL.WRAPPED) {
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const nc = c + dc, nr = r + dr;
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
            extra.add(`${nc},${nr}`);
          }
        }
      }
    } else if (candy.special === SPECIAL.COLOR_BOMB) {
      let targetType = -1;
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dc, dr]) => {
        const n = grid[c + dc]?.[r + dr];
        if (n && matched.has(`${c+dc},${r+dr}`) && targetType === -1) {
          targetType = n.type;
        }
      });
      if (targetType === -1) targetType = Math.floor(Math.random() * CANDY_COUNT);
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          if (grid[col][row]?.type === targetType) extra.add(`${col},${row}`);
        }
      }
    }
  });

  return extra;
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
      // Swap right
      if (c < COLS - 1) {
        const swapped = swapCells(grid, c, r, c + 1, r);
        if (findMatches(swapped).matched.size > 0) return true;
      }
      // Swap down
      if (r < ROWS - 1) {
        const swapped = swapCells(grid, c, r, c, r + 1);
        if (findMatches(swapped).matched.size > 0) return true;
      }
    }
  }
  return false;
}

export function findHint(grid) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1) {
        const swapped = swapCells(grid, c, r, c + 1, r);
        if (findMatches(swapped).matched.size > 0) return { col: c, row: r };
      }
      if (r < ROWS - 1) {
        const swapped = swapCells(grid, c, r, c, r + 1);
        if (findMatches(swapped).matched.size > 0) return { col: c, row: r };
      }
    }
  }
  return null;
}

export function shuffleBoard(grid) {
  const candies = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[c][r]) candies.push(grid[c][r]);
    }
  }
  // Fisher-Yates
  for (let i = candies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candies[i], candies[j]] = [candies[j], candies[i]];
  }
  const newGrid = [];
  let idx = 0;
  for (let c = 0; c < COLS; c++) {
    newGrid[c] = [];
    for (let r = 0; r < ROWS; r++) {
      newGrid[c][r] = candies[idx++];
    }
  }
  return newGrid;
}
