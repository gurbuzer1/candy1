// ===== UI MANAGER =====

class UIManager {
    constructor() {
        this.elements = {
            menuScreen: document.getElementById('menu-screen'),
            levelScreen: document.getElementById('level-screen'),
            gameHud: document.getElementById('game-hud'),
            levelComplete: document.getElementById('level-complete'),
            levelFailed: document.getElementById('level-failed'),
            howToPlay: document.getElementById('how-to-play'),
            hudScore: document.getElementById('hud-score'),
            hudMoves: document.getElementById('hud-moves'),
            hudLevelNum: document.getElementById('hud-level-num'),
            targetBar: document.getElementById('target-bar'),
            finalScore: document.getElementById('final-score'),
            failedScore: document.getElementById('failed-score'),
            levelGrid: document.getElementById('level-grid'),
            starsDisplay: document.getElementById('stars-display'),
            star1Marker: document.getElementById('star1-marker'),
            star2Marker: document.getElementById('star2-marker'),
            star3Marker: document.getElementById('star3-marker'),
        };

        this.onLevelSelect = null;
        this._bindButtons();
    }

    _bindButtons() {
        document.getElementById('play-btn').addEventListener('click', () => {
            audio.init();
            this.showScreen('level');
        });

        document.getElementById('how-to-play-btn').addEventListener('click', () => {
            audio.init();
            this.showPopup('howToPlay');
        });

        document.getElementById('close-how-to').addEventListener('click', () => {
            this.hidePopup('howToPlay');
        });

        document.getElementById('level-back-btn').addEventListener('click', () => {
            this.showScreen('menu');
        });

        document.getElementById('game-back-btn').addEventListener('click', () => {
            this.showScreen('level');
        });

        document.getElementById('next-level-btn').addEventListener('click', () => {
            this.hidePopup('levelComplete');
            if (this.onNextLevel) this.onNextLevel();
        });

        document.getElementById('replay-btn').addEventListener('click', () => {
            this.hidePopup('levelComplete');
            if (this.onReplay) this.onReplay();
        });

        document.getElementById('retry-btn').addEventListener('click', () => {
            this.hidePopup('levelFailed');
            if (this.onReplay) this.onReplay();
        });

        document.getElementById('quit-btn').addEventListener('click', () => {
            this.hidePopup('levelFailed');
            this.showScreen('level');
        });
    }

    showScreen(screen) {
        // Hide all screens
        this.elements.menuScreen.classList.remove('active');
        this.elements.levelScreen.classList.remove('active');
        this.elements.gameHud.classList.remove('active');

        switch (screen) {
            case 'menu':
                this.elements.menuScreen.classList.add('active');
                break;
            case 'level':
                this.elements.levelScreen.classList.add('active');
                this.buildLevelGrid();
                break;
            case 'game':
                this.elements.gameHud.classList.add('active');
                break;
        }
    }

    showPopup(popup) {
        const el = this.elements[popup];
        if (el) el.classList.add('active');
    }

    hidePopup(popup) {
        const el = this.elements[popup];
        if (el) el.classList.remove('active');
    }

    buildLevelGrid() {
        const grid = this.elements.levelGrid;
        grid.innerHTML = '';

        LEVELS.forEach((level, i) => {
            const num = i + 1;
            const btn = document.createElement('button');
            btn.className = 'level-btn';

            const unlocked = progress.isUnlocked(num);
            const stars = progress.getStars(num);
            const isCurrent = num === progress.maxLevel;

            if (isCurrent) {
                btn.classList.add('current');
            } else if (unlocked) {
                btn.classList.add('unlocked');
            } else {
                btn.classList.add('locked');
            }

            btn.innerHTML = `
                <span>${unlocked ? num : '&#128274;'}</span>
                ${unlocked ? `<span class="level-stars">${this._starsHTML(stars)}</span>` : ''}
            `;

            if (unlocked) {
                btn.addEventListener('click', () => {
                    if (this.onLevelSelect) this.onLevelSelect(num);
                });
            }

            grid.appendChild(btn);
        });
    }

    _starsHTML(count) {
        let html = '';
        for (let i = 0; i < 3; i++) {
            html += i < count
                ? '<span>&#9733;</span>'
                : '<span class="empty">&#9733;</span>';
        }
        return html;
    }

    updateHUD(score, moves, levelNum) {
        this.elements.hudScore.textContent = score.toLocaleString();
        this.elements.hudMoves.textContent = moves;
        this.elements.hudLevelNum.textContent = levelNum;

        // Color moves red when low
        if (moves <= 5) {
            this.elements.hudMoves.style.color = '#ff4757';
        } else {
            this.elements.hudMoves.style.color = '#ffd700';
        }
    }

    updateTargetBar(score, level) {
        const percent = Math.min(100, (score / level.target3) * 100);
        this.elements.targetBar.style.width = percent + '%';

        // Update star markers
        const markers = [
            { el: this.elements.star1Marker, threshold: level.target1 },
            { el: this.elements.star2Marker, threshold: level.target2 },
            { el: this.elements.star3Marker, threshold: level.target3 }
        ];

        markers.forEach(m => {
            if (score >= m.threshold) {
                m.el.classList.add('earned');
            } else {
                m.el.classList.remove('earned');
            }
        });
    }

    showLevelComplete(score, stars) {
        this.elements.finalScore.textContent = score.toLocaleString();

        const starEls = this.elements.starsDisplay.querySelectorAll('.star');
        starEls.forEach((el, i) => {
            el.classList.remove('earned');
            if (i < stars) {
                setTimeout(() => {
                    el.classList.add('earned');
                }, 300 + i * 400);
            }
        });

        this.showPopup('levelComplete');
        audio.playLevelComplete();
    }

    showLevelFailed(score) {
        this.elements.failedScore.textContent = score.toLocaleString();
        this.showPopup('levelFailed');
        audio.playLevelFailed();
    }
}
