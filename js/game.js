// ===== MAIN GAME ENGINE =====

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.board = new Board(COLS, ROWS);
        this.effects = new EffectsManager();
        this.input = new InputHandler(canvas);
        this.ui = new UIManager();

        this.state = GAME_STATE.IDLE;
        this.score = 0;
        this.movesLeft = 0;
        this.currentLevel = 1;
        this.levelConfig = null;
        this.cascadeLevel = 0;
        this.comboMultiplier = 1;

        this.selectedCell = null;
        this.swapCell1 = null;
        this.swapCell2 = null;

        // Hint system
        this.hintTimer = 0;
        this.hintCell = null;
        this.hintDelay = 5; // seconds before showing hint

        // Timing
        this.stateTimer = 0;
        this.lastTime = 0;

        this._setupInput();
        this._setupUI();
        this._resize();

        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const container = document.getElementById('game-container');
        const w = container.clientWidth;
        const h = container.clientHeight;

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = w;
        this.height = h;

        this.board.resize(w, h);
    }

    _setupInput() {
        this.input.onCellTap = (x, y) => {
            if (this.state !== GAME_STATE.IDLE && this.state !== GAME_STATE.SELECTED) return;

            const cell = this.board.getCellFromPoint(x, y);
            if (!cell) return;

            if (this.state === GAME_STATE.IDLE) {
                this.selectedCell = cell;
                this.state = GAME_STATE.SELECTED;
                this._resetHint();
                audio.playSelect();

                // Scale up selected candy
                const candy = this.board.getCandy(cell.col, cell.row);
                if (candy) candy.targetScale = 1.15;

            } else if (this.state === GAME_STATE.SELECTED) {
                // Check if adjacent
                const dc = Math.abs(cell.col - this.selectedCell.col);
                const dr = Math.abs(cell.row - this.selectedCell.row);

                if (dc + dr === 1) {
                    this._trySwap(this.selectedCell, cell);
                } else {
                    // Deselect previous, select new
                    const prev = this.board.getCandy(this.selectedCell.col, this.selectedCell.row);
                    if (prev) prev.targetScale = 1;

                    this.selectedCell = cell;
                    audio.playSelect();

                    const candy = this.board.getCandy(cell.col, cell.row);
                    if (candy) candy.targetScale = 1.15;
                }
            }
        };

        this.input.onSwipe = (x, y, dirCol, dirRow) => {
            if (this.state !== GAME_STATE.IDLE && this.state !== GAME_STATE.SELECTED) return;

            const cell = this.board.getCellFromPoint(x, y);
            if (!cell) return;

            const target = {
                col: cell.col + dirCol,
                row: cell.row + dirRow
            };

            if (target.col >= 0 && target.col < COLS && target.row >= 0 && target.row < ROWS) {
                this._trySwap(cell, target);
            }
        };
    }

    _setupUI() {
        this.ui.onLevelSelect = (levelNum) => {
            this.startLevel(levelNum);
        };

        this.ui.onNextLevel = () => {
            if (this.currentLevel < LEVELS.length) {
                this.startLevel(this.currentLevel + 1);
            } else {
                this.ui.showScreen('level');
            }
        };

        this.ui.onReplay = () => {
            this.startLevel(this.currentLevel);
        };
    }

    startLevel(levelNum) {
        this.currentLevel = levelNum;
        this.levelConfig = LEVELS[levelNum - 1];
        this.score = 0;
        this.movesLeft = this.levelConfig.moves;
        this.cascadeLevel = 0;
        this.comboMultiplier = 1;
        this.selectedCell = null;
        this.hintCell = null;
        this.hintTimer = 0;

        this.board = new Board(this.levelConfig.cols, this.levelConfig.rows);
        this.board.init();
        this._resize();

        // Make sure no initial matches
        let hasMatches = true;
        let safety = 0;
        while (hasMatches && safety < 100) {
            const { matched } = this.board.findMatches();
            if (matched.size > 0) {
                this.board.init();
                this._resize();
                safety++;
            } else {
                hasMatches = false;
            }
        }

        this.state = GAME_STATE.IDLE;
        this.ui.showScreen('game');
        this.ui.updateHUD(this.score, this.movesLeft, this.currentLevel);
        this.ui.updateTargetBar(this.score, this.levelConfig);
    }

    _trySwap(cell1, cell2) {
        // Reset previous selection visual
        if (this.selectedCell) {
            const prev = this.board.getCandy(this.selectedCell.col, this.selectedCell.row);
            if (prev) prev.targetScale = 1;
        }

        this.swapCell1 = cell1;
        this.swapCell2 = cell2;
        this.selectedCell = null;
        this._resetHint();

        this.board.swap(cell1.col, cell1.row, cell2.col, cell2.row);
        this.state = GAME_STATE.SWAPPING;
        this.stateTimer = SWAP_SPEED;
        audio.playSwap();
    }

    _resetHint() {
        this.hintTimer = 0;
        this.hintCell = null;
    }

    _findHint() {
        for (let c = 0; c < this.board.cols; c++) {
            for (let r = 0; r < this.board.rows; r++) {
                if (c < this.board.cols - 1) {
                    this.board._rawSwap(c, r, c + 1, r);
                    const { matched } = this.board.findMatches();
                    this.board._rawSwap(c, r, c + 1, r);
                    if (matched.size > 0) return { col: c, row: r };
                }
                if (r < this.board.rows - 1) {
                    this.board._rawSwap(c, r, c, r + 1);
                    const { matched } = this.board.findMatches();
                    this.board._rawSwap(c, r, c, r + 1);
                    if (matched.size > 0) return { col: c, row: r };
                }
            }
        }
        return null;
    }

    update(dt) {
        // Cap dt to prevent large jumps
        dt = Math.min(dt, 0.05);

        this.board.update(dt);
        this.effects.update(dt);

        switch (this.state) {
            case GAME_STATE.IDLE:
                this._updateIdle(dt);
                break;
            case GAME_STATE.SELECTED:
                this._updateIdle(dt);
                break;
            case GAME_STATE.SWAPPING:
                this._updateSwapping(dt);
                break;
            case GAME_STATE.SWAP_BACK:
                this._updateSwapBack(dt);
                break;
            case GAME_STATE.MATCHING:
                this._updateMatching(dt);
                break;
            case GAME_STATE.REMOVING:
                this._updateRemoving(dt);
                break;
            case GAME_STATE.FALLING:
                this._updateFalling(dt);
                break;
            case GAME_STATE.REFILLING:
                this._updateRefilling(dt);
                break;
        }
    }

    _updateIdle(dt) {
        // Hint timer
        this.hintTimer += dt;
        if (this.hintTimer >= this.hintDelay && !this.hintCell) {
            this.hintCell = this._findHint();
        }

        // Animate hint
        if (this.hintCell) {
            const candy = this.board.getCandy(this.hintCell.col, this.hintCell.row);
            if (candy) {
                candy.targetScale = 1 + Math.sin(this.hintTimer * 4) * 0.1;
            }
        }
    }

    _updateSwapping(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 && !this.board.isAnimating()) {
            // Check for matches after swap
            const { matched, matchGroups } = this.board.findMatches();
            if (matched.size > 0) {
                this.movesLeft--;
                this.cascadeLevel = 0;
                this.comboMultiplier = 1;
                this._processMatches(matched, matchGroups);
            } else {
                // No match - swap back
                this.board.swap(this.swapCell1.col, this.swapCell1.row, this.swapCell2.col, this.swapCell2.row);
                this.state = GAME_STATE.SWAP_BACK;
                this.stateTimer = SWAP_SPEED;
                audio.playInvalidSwap();
            }
        }
    }

    _updateSwapBack(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 && !this.board.isAnimating()) {
            this.state = GAME_STATE.IDLE;
        }
    }

    _updateMatching(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.state = GAME_STATE.FALLING;
            this.board.applyGravity();
            this.stateTimer = FALL_SPEED * this.board.rows;
            audio.playFall();
        }
    }

    _updateRemoving(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.state = GAME_STATE.FALLING;
            this.board.applyGravity();
            this.stateTimer = FALL_SPEED * this.board.rows;
        }
    }

    _updateFalling(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 && !this.board.isAnimating()) {
            this.state = GAME_STATE.REFILLING;
            this.board.fillEmpty();
            this.stateTimer = FALL_SPEED * this.board.rows;
        }
    }

    _updateRefilling(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 && !this.board.isAnimating()) {
            // Check for cascade matches
            const { matched, matchGroups } = this.board.findMatches();
            if (matched.size > 0) {
                this.cascadeLevel++;
                this.comboMultiplier = Math.pow(SCORE.CASCADE_MULTIPLIER, this.cascadeLevel);
                this._processMatches(matched, matchGroups);
            } else {
                // Done cascading - check game state
                this._checkGameState();
            }
        }
    }

    _processMatches(matched, matchGroups) {
        // Determine specials before removing
        const specials = this.board.determineSpecials(matchGroups);

        // Calculate score
        let baseScore = 0;
        matchGroups.forEach(group => {
            switch (group.cells.length) {
                case 3: baseScore += SCORE.MATCH_3; break;
                case 4: baseScore += SCORE.MATCH_4; break;
                default: baseScore += SCORE.MATCH_5; break;
            }
        });

        specials.forEach(spec => {
            switch (spec.special) {
                case SPECIAL.STRIPED_H:
                case SPECIAL.STRIPED_V:
                    baseScore += SCORE.SPECIAL_STRIPED;
                    break;
                case SPECIAL.WRAPPED:
                    baseScore += SCORE.SPECIAL_WRAPPED;
                    break;
                case SPECIAL.COLOR_BOMB:
                    baseScore += SCORE.SPECIAL_COLOR_BOMB;
                    break;
            }
        });

        const totalScore = Math.floor(baseScore * this.comboMultiplier);
        this.score += totalScore;

        // Spawn score popup at center of match
        if (matchGroups.length > 0) {
            const centerGroup = matchGroups[0];
            const centerCell = centerGroup.cells[Math.floor(centerGroup.cells.length / 2)];
            const pos = this.board.getCellCenter(centerCell.col, centerCell.row);
            const color = this.cascadeLevel > 0 ? '#ffd700' : '#fff';
            this.effects.spawnScorePopup(pos.x, pos.y, totalScore, color);
        }

        // Remove matches
        this.board.removeMatches(matched, this.effects);

        // Place specials
        this.board.placeSpecials(specials);

        audio.playMatch(this.cascadeLevel);

        // Update UI
        this.ui.updateHUD(this.score, this.movesLeft, this.currentLevel);
        this.ui.updateTargetBar(this.score, this.levelConfig);

        this.state = GAME_STATE.MATCHING;
        this.stateTimer = MATCH_PAUSE;
    }

    _checkGameState() {
        // Check win condition
        if (this.score >= this.levelConfig.target1) {
            if (this.movesLeft <= 0) {
                this._levelComplete();
                return;
            }
        }

        // Check lose condition
        if (this.movesLeft <= 0) {
            if (this.score >= this.levelConfig.target1) {
                this._levelComplete();
            } else {
                this._levelFailed();
            }
            return;
        }

        // Check for valid moves
        if (!this.board.hasValidMoves()) {
            this.board.shuffle();
            // After shuffle, check again
            if (!this.board.hasValidMoves()) {
                // Re-initialize board
                this.board.init();
                this._resize();
            }
        }

        this.state = GAME_STATE.IDLE;
        this._resetHint();
    }

    _levelComplete() {
        this.state = GAME_STATE.LEVEL_COMPLETE;
        const starsEarned = progress.completeLevel(this.currentLevel, this.score);

        setTimeout(() => {
            this.ui.showLevelComplete(this.score, starsEarned);
        }, 600);
    }

    _levelFailed() {
        this.state = GAME_STATE.LEVEL_FAILED;

        setTimeout(() => {
            this.ui.showLevelFailed(this.score);
        }, 600);
    }

    draw() {
        const ctx = this.ctx;

        // Clear
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#2d1b69');
        bgGrad.addColorStop(0.5, '#1a0533');
        bgGrad.addColorStop(1, '#0d021a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Background decorations
        this._drawBackgroundStars(ctx);

        // Draw board
        this.board.draw(ctx, this.selectedCell, this.hintCell);

        // Draw effects
        this.effects.draw(ctx);

        // Cascade text
        if (this.cascadeLevel > 0 && (this.state === GAME_STATE.MATCHING || this.state === GAME_STATE.FALLING || this.state === GAME_STATE.REFILLING)) {
            this._drawCascadeText(ctx);
        }
    }

    _drawBackgroundStars(ctx) {
        // Simple twinkling stars
        ctx.save();
        const time = performance.now() * 0.001;
        for (let i = 0; i < 20; i++) {
            const x = ((i * 137.5) % this.width);
            const y = ((i * 89.3) % this.height);
            const alpha = 0.1 + Math.sin(time * 0.5 + i * 1.7) * 0.08;
            const size = 1 + (i % 3);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    _drawCascadeText(ctx) {
        const labels = ['', 'Sweet!', 'Tasty!', 'Delicious!', 'Sugar Rush!', 'INCREDIBLE!'];
        const label = labels[Math.min(this.cascadeLevel, labels.length - 1)];
        if (!label) return;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Fredoka One", sans-serif';

        const y = this.board.offsetY - 25;
        const x = this.width / 2;

        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.strokeText(label, x, y);

        const colors = ['', '#ffd700', '#ff6bcb', '#ff4757', '#a855f7', '#00ff88'];
        ctx.fillStyle = colors[Math.min(this.cascadeLevel, colors.length - 1)];
        ctx.fillText(label, x, y);
        ctx.restore();
    }

    // Main game loop
    run() {
        const loop = (timestamp) => {
            const dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0.016;
            this.lastTime = timestamp;

            this.update(dt);
            this.draw();

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }
}
