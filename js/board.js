// ===== BOARD LOGIC =====

class Board {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.cellSize = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    init() {
        this.grid = [];
        for (let c = 0; c < this.cols; c++) {
            this.grid[c] = [];
            for (let r = 0; r < this.rows; r++) {
                let type;
                do {
                    type = Math.floor(Math.random() * CANDY_COUNT);
                } while (this._wouldMatch(c, r, type));

                const candy = new Candy(type, c, r);
                this.grid[c][r] = candy;
            }
        }
    }

    resize(canvasWidth, canvasHeight) {
        const hudHeight = 110;
        const padding = 12;
        const availW = canvasWidth - padding * 2;
        const availH = canvasHeight - hudHeight - padding * 2;

        this.cellSize = Math.floor(Math.min(availW / this.cols, availH / this.rows));
        this.offsetX = Math.floor((canvasWidth - this.cellSize * this.cols) / 2);
        this.offsetY = hudHeight + Math.floor((availH - this.cellSize * this.rows) / 2) + padding;

        // Update candy positions
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[c][r]) {
                    const pos = this.getCellCenter(c, r);
                    this.grid[c][r].setPosition(pos.x, pos.y);
                }
            }
        }
    }

    getCellCenter(col, row) {
        return {
            x: this.offsetX + col * this.cellSize + this.cellSize / 2,
            y: this.offsetY + row * this.cellSize + this.cellSize / 2
        };
    }

    getCellFromPoint(px, py) {
        const col = Math.floor((px - this.offsetX) / this.cellSize);
        const row = Math.floor((py - this.offsetY) / this.cellSize);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return { col, row };
        }
        return null;
    }

    getCandy(col, row) {
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return this.grid[col][row];
        }
        return null;
    }

    swap(c1, r1, c2, r2) {
        const temp = this.grid[c1][r1];
        this.grid[c1][r1] = this.grid[c2][r2];
        this.grid[c2][r2] = temp;

        if (this.grid[c1][r1]) {
            this.grid[c1][r1].col = c1;
            this.grid[c1][r1].row = r1;
            const pos1 = this.getCellCenter(c1, r1);
            this.grid[c1][r1].setTarget(pos1.x, pos1.y);
        }
        if (this.grid[c2][r2]) {
            this.grid[c2][r2].col = c2;
            this.grid[c2][r2].row = r2;
            const pos2 = this.getCellCenter(c2, r2);
            this.grid[c2][r2].setTarget(pos2.x, pos2.y);
        }
    }

    // Check if placing type at (col, row) would create a match
    _wouldMatch(col, row, type) {
        // Horizontal
        if (col >= 2) {
            const left1 = this.grid[col - 1]?.[row];
            const left2 = this.grid[col - 2]?.[row];
            if (left1 && left2 && left1.type === type && left2.type === type) return true;
        }
        // Vertical
        if (row >= 2) {
            const up1 = this.grid[col]?.[row - 1];
            const up2 = this.grid[col]?.[row - 2];
            if (up1 && up2 && up1.type === type && up2.type === type) return true;
        }
        return false;
    }

    // Find all matches on the board
    findMatches() {
        const matched = new Set();
        const matchGroups = [];

        // Horizontal matches
        for (let r = 0; r < this.rows; r++) {
            let matchStart = 0;
            for (let c = 1; c <= this.cols; c++) {
                const curr = this.getCandy(c, r);
                const prev = this.getCandy(c - 1, r);
                if (curr && prev && curr.type === prev.type && curr.special !== SPECIAL.COLOR_BOMB && prev.special !== SPECIAL.COLOR_BOMB) {
                    continue;
                }
                const matchLen = c - matchStart;
                if (matchLen >= 3) {
                    const group = [];
                    for (let mc = matchStart; mc < c; mc++) {
                        const key = mc + ',' + r;
                        matched.add(key);
                        group.push({ col: mc, row: r });
                    }
                    matchGroups.push({ cells: group, type: this.getCandy(matchStart, r).type, direction: 'horizontal' });
                }
                matchStart = c;
            }
        }

        // Vertical matches
        for (let c = 0; c < this.cols; c++) {
            let matchStart = 0;
            for (let r = 1; r <= this.rows; r++) {
                const curr = this.getCandy(c, r);
                const prev = this.getCandy(c, r - 1);
                if (curr && prev && curr.type === prev.type && curr.special !== SPECIAL.COLOR_BOMB && prev.special !== SPECIAL.COLOR_BOMB) {
                    continue;
                }
                const matchLen = r - matchStart;
                if (matchLen >= 3) {
                    const group = [];
                    for (let mr = matchStart; mr < r; mr++) {
                        const key = c + ',' + mr;
                        matched.add(key);
                        group.push({ col: c, row: mr });
                    }
                    matchGroups.push({ cells: group, type: this.getCandy(c, matchStart).type, direction: 'vertical' });
                }
                matchStart = r;
            }
        }

        return { matched, matchGroups };
    }

    // Determine special candies to create from matches
    determineSpecials(matchGroups) {
        const specials = [];
        const processedCells = new Set();

        // Check for intersections (L/T shapes → wrapped)
        for (let i = 0; i < matchGroups.length; i++) {
            for (let j = i + 1; j < matchGroups.length; j++) {
                if (matchGroups[i].type !== matchGroups[j].type) continue;
                const intersection = matchGroups[i].cells.find(a =>
                    matchGroups[j].cells.some(b => a.col === b.col && a.row === b.row)
                );
                if (intersection) {
                    const allCells = [...matchGroups[i].cells, ...matchGroups[j].cells];
                    const key = intersection.col + ',' + intersection.row;
                    if (!processedCells.has(key)) {
                        specials.push({
                            col: intersection.col,
                            row: intersection.row,
                            type: matchGroups[i].type,
                            special: SPECIAL.WRAPPED
                        });
                        processedCells.add(key);
                        allCells.forEach(cell => processedCells.add(cell.col + ',' + cell.row));
                    }
                }
            }
        }

        // Check for 5+ (color bomb) and 4 (striped)
        matchGroups.forEach(group => {
            const cells = group.cells;
            if (cells.every(c => processedCells.has(c.col + ',' + c.row))) return;

            if (cells.length >= 5) {
                const center = cells[Math.floor(cells.length / 2)];
                const key = center.col + ',' + center.row;
                if (!processedCells.has(key)) {
                    specials.push({
                        col: center.col,
                        row: center.row,
                        type: group.type,
                        special: SPECIAL.COLOR_BOMB
                    });
                    processedCells.add(key);
                }
            } else if (cells.length === 4) {
                const center = cells[1];
                const key = center.col + ',' + center.row;
                if (!processedCells.has(key)) {
                    specials.push({
                        col: center.col,
                        row: center.row,
                        type: group.type,
                        special: group.direction === 'horizontal' ? SPECIAL.STRIPED_V : SPECIAL.STRIPED_H
                    });
                    processedCells.add(key);
                }
            }
        });

        return specials;
    }

    // Remove matched candies and handle specials
    removeMatches(matched, effects) {
        const additionalRemoves = new Set();

        // Check for special candy activations
        matched.forEach(key => {
            const [c, r] = key.split(',').map(Number);
            const candy = this.getCandy(c, r);
            if (!candy) return;

            if (candy.special === SPECIAL.STRIPED_H) {
                for (let col = 0; col < this.cols; col++) {
                    additionalRemoves.add(col + ',' + r);
                }
                const pos = this.getCellCenter(c, r);
                effects.spawnLineEffect(pos.x, pos.y, true);
                audio.playSpecial();
            } else if (candy.special === SPECIAL.STRIPED_V) {
                for (let row = 0; row < this.rows; row++) {
                    additionalRemoves.add(c + ',' + row);
                }
                const pos = this.getCellCenter(c, r);
                effects.spawnLineEffect(pos.x, pos.y, false);
                audio.playSpecial();
            } else if (candy.special === SPECIAL.WRAPPED) {
                for (let dc = -1; dc <= 1; dc++) {
                    for (let dr = -1; dr <= 1; dr++) {
                        const nc = c + dc;
                        const nr = r + dr;
                        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                            additionalRemoves.add(nc + ',' + nr);
                        }
                    }
                }
                const pos = this.getCellCenter(c, r);
                effects.spawnShockwave(pos.x, pos.y);
                audio.playSpecial();
            } else if (candy.special === SPECIAL.COLOR_BOMB) {
                // Find a matched neighbor to determine target color
                let targetType = -1;
                [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dc, dr]) => {
                    const neighbor = this.getCandy(c + dc, r + dr);
                    if (neighbor && matched.has((c+dc) + ',' + (r+dr)) && targetType === -1) {
                        targetType = neighbor.type;
                    }
                });
                if (targetType === -1) {
                    // Pick random color if no matched neighbor
                    targetType = Math.floor(Math.random() * CANDY_COUNT);
                }
                // Remove all candies of that type
                for (let col = 0; col < this.cols; col++) {
                    for (let row = 0; row < this.rows; row++) {
                        const candy2 = this.getCandy(col, row);
                        if (candy2 && candy2.type === targetType) {
                            additionalRemoves.add(col + ',' + row);
                        }
                    }
                }
                const pos = this.getCellCenter(c, r);
                effects.spawnColorBombEffect(pos.x, pos.y);
                audio.playColorBomb();
            }
        });

        // Merge additional removes
        additionalRemoves.forEach(key => matched.add(key));

        // Actually remove and spawn particles
        let removedCount = 0;
        matched.forEach(key => {
            const [c, r] = key.split(',').map(Number);
            const candy = this.getCandy(c, r);
            if (candy) {
                const pos = this.getCellCenter(c, r);
                effects.spawnMatchParticles(pos.x, pos.y, candy.type);
                this.grid[c][r] = null;
                removedCount++;
            }
        });

        return removedCount;
    }

    // Place special candies after removal
    placeSpecials(specials) {
        specials.forEach(spec => {
            if (!this.grid[spec.col][spec.row]) {
                const candy = new Candy(spec.type, spec.col, spec.row);
                candy.special = spec.special;
                const pos = this.getCellCenter(spec.col, spec.row);
                candy.setPosition(pos.x, pos.y);
                candy.targetScale = 1;
                candy.scale = 0;
                this.grid[spec.col][spec.row] = candy;
            }
        });
    }

    // Drop candies down to fill gaps
    applyGravity() {
        let moved = false;
        for (let c = 0; c < this.cols; c++) {
            let writePos = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[c][r]) {
                    if (r !== writePos) {
                        this.grid[c][writePos] = this.grid[c][r];
                        this.grid[c][r] = null;
                        this.grid[c][writePos].row = writePos;
                        this.grid[c][writePos].col = c;
                        const pos = this.getCellCenter(c, writePos);
                        this.grid[c][writePos].setTarget(pos.x, pos.y);
                        this.grid[c][writePos].bouncePhase = 1;
                        moved = true;
                    }
                    writePos--;
                }
            }
        }
        return moved;
    }

    // Fill empty spaces at the top with new candies
    fillEmpty() {
        let filled = false;
        for (let c = 0; c < this.cols; c++) {
            let emptyCount = 0;
            // Count empty from top
            for (let r = 0; r < this.rows; r++) {
                if (!this.grid[c][r]) emptyCount++;
            }

            for (let r = 0; r < this.rows; r++) {
                if (!this.grid[c][r]) {
                    const type = Math.floor(Math.random() * CANDY_COUNT);
                    const candy = new Candy(type, c, r);
                    const targetPos = this.getCellCenter(c, r);
                    // Start above the board
                    candy.setPosition(targetPos.x, this.offsetY - (emptyCount - r) * this.cellSize - this.cellSize / 2);
                    candy.setTarget(targetPos.x, targetPos.y);
                    candy.bouncePhase = 1;
                    this.grid[c][r] = candy;
                    filled = true;
                }
            }
        }
        return filled;
    }

    // Check if any valid moves exist
    hasValidMoves() {
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                // Try swap right
                if (c < this.cols - 1) {
                    this._rawSwap(c, r, c + 1, r);
                    const { matched } = this.findMatches();
                    this._rawSwap(c, r, c + 1, r);
                    if (matched.size > 0) return true;
                }
                // Try swap down
                if (r < this.rows - 1) {
                    this._rawSwap(c, r, c, r + 1);
                    const { matched } = this.findMatches();
                    this._rawSwap(c, r, c, r + 1);
                    if (matched.size > 0) return true;
                }
            }
        }
        return false;
    }

    _rawSwap(c1, r1, c2, r2) {
        const temp = this.grid[c1][r1];
        this.grid[c1][r1] = this.grid[c2][r2];
        this.grid[c2][r2] = temp;
    }

    // Shuffle board if no valid moves
    shuffle() {
        const candies = [];
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[c][r]) {
                    candies.push(this.grid[c][r]);
                }
            }
        }

        // Fisher-Yates shuffle
        for (let i = candies.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candies[i], candies[j]] = [candies[j], candies[i]];
        }

        let idx = 0;
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                this.grid[c][r] = candies[idx];
                this.grid[c][r].col = c;
                this.grid[c][r].row = r;
                const pos = this.getCellCenter(c, r);
                this.grid[c][r].setTarget(pos.x, pos.y);
                idx++;
            }
        }
    }

    // Check if any candy is still animating movement
    isAnimating() {
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[c][r] && this.grid[c][r].isMoving) return true;
            }
        }
        return false;
    }

    update(dt) {
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[c][r]) {
                    this.grid[c][r].update(dt);
                }
            }
        }
    }

    draw(ctx, selectedCell, hintCell) {
        // Draw board background
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        const bgPad = 6;
        const cornerR = 12;
        ctx.beginPath();
        this._roundedRect(ctx,
            this.offsetX - bgPad,
            this.offsetY - bgPad,
            this.cols * this.cellSize + bgPad * 2,
            this.rows * this.cellSize + bgPad * 2,
            cornerR
        );
        ctx.fill();

        // Draw cell backgrounds (checkerboard)
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                const x = this.offsetX + c * this.cellSize;
                const y = this.offsetY + r * this.cellSize;
                ctx.fillStyle = (c + r) % 2 === 0
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(255,255,255,0.03)';
                ctx.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }

        // Draw selection highlight
        if (selectedCell) {
            const sx = this.offsetX + selectedCell.col * this.cellSize;
            const sy = this.offsetY + selectedCell.row * this.cellSize;
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(sx, sy, this.cellSize, this.cellSize);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 1, sy + 1, this.cellSize - 2, this.cellSize - 2);
        }

        // Draw hint highlight
        if (hintCell) {
            const hx = this.offsetX + hintCell.col * this.cellSize;
            const hy = this.offsetY + hintCell.row * this.cellSize;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.fillRect(hx, hy, this.cellSize, this.cellSize);
        }

        // Draw candies
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[c][r]) {
                    this.grid[c][r].draw(ctx, this.cellSize);
                }
            }
        }
    }

    _roundedRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }
}
