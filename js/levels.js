// ===== LEVEL DEFINITIONS =====

const LEVELS = [
    { // Level 1 - Tutorial
        moves: 30,
        target1: 1000,
        target2: 2500,
        target3: 5000,
        cols: 9,
        rows: 9
    },
    { // Level 2
        moves: 28,
        target1: 1500,
        target2: 3500,
        target3: 6000,
        cols: 9,
        rows: 9
    },
    { // Level 3
        moves: 25,
        target1: 2000,
        target2: 4000,
        target3: 7000,
        cols: 9,
        rows: 9
    },
    { // Level 4
        moves: 25,
        target1: 2500,
        target2: 5000,
        target3: 8000,
        cols: 9,
        rows: 9
    },
    { // Level 5
        moves: 22,
        target1: 3000,
        target2: 6000,
        target3: 10000,
        cols: 9,
        rows: 9
    },
    { // Level 6
        moves: 22,
        target1: 3500,
        target2: 7000,
        target3: 12000,
        cols: 9,
        rows: 9
    },
    { // Level 7
        moves: 20,
        target1: 4000,
        target2: 8000,
        target3: 14000,
        cols: 9,
        rows: 9
    },
    { // Level 8
        moves: 20,
        target1: 4500,
        target2: 9000,
        target3: 15000,
        cols: 9,
        rows: 9
    },
    { // Level 9
        moves: 18,
        target1: 5000,
        target2: 10000,
        target3: 16000,
        cols: 9,
        rows: 9
    },
    { // Level 10
        moves: 18,
        target1: 5500,
        target2: 11000,
        target3: 18000,
        cols: 9,
        rows: 9
    },
    { // Level 11
        moves: 18,
        target1: 6000,
        target2: 12000,
        target3: 20000,
        cols: 9,
        rows: 9
    },
    { // Level 12
        moves: 16,
        target1: 6500,
        target2: 13000,
        target3: 22000,
        cols: 9,
        rows: 9
    },
    { // Level 13
        moves: 16,
        target1: 7000,
        target2: 14000,
        target3: 24000,
        cols: 9,
        rows: 9
    },
    { // Level 14
        moves: 15,
        target1: 7500,
        target2: 15000,
        target3: 26000,
        cols: 9,
        rows: 9
    },
    { // Level 15
        moves: 15,
        target1: 8000,
        target2: 16000,
        target3: 28000,
        cols: 9,
        rows: 9
    },
    { // Level 16
        moves: 14,
        target1: 8500,
        target2: 17000,
        target3: 30000,
        cols: 9,
        rows: 9
    },
    { // Level 17
        moves: 14,
        target1: 9000,
        target2: 18000,
        target3: 32000,
        cols: 9,
        rows: 9
    },
    { // Level 18
        moves: 13,
        target1: 9500,
        target2: 19000,
        target3: 34000,
        cols: 9,
        rows: 9
    },
    { // Level 19
        moves: 13,
        target1: 10000,
        target2: 20000,
        target3: 36000,
        cols: 9,
        rows: 9
    },
    { // Level 20
        moves: 12,
        target1: 12000,
        target2: 24000,
        target3: 40000,
        cols: 9,
        rows: 9
    },
    { // Level 21
        moves: 12,
        target1: 13000,
        target2: 26000,
        target3: 42000,
        cols: 9,
        rows: 9
    },
    { // Level 22
        moves: 12,
        target1: 14000,
        target2: 28000,
        target3: 44000,
        cols: 9,
        rows: 9
    },
    { // Level 23
        moves: 11,
        target1: 15000,
        target2: 30000,
        target3: 46000,
        cols: 9,
        rows: 9
    },
    { // Level 24
        moves: 11,
        target1: 16000,
        target2: 32000,
        target3: 48000,
        cols: 9,
        rows: 9
    },
    { // Level 25
        moves: 10,
        target1: 18000,
        target2: 36000,
        target3: 50000,
        cols: 9,
        rows: 9
    },
    { // Level 26
        moves: 15,
        target1: 14000,
        target2: 28000,
        target3: 45000,
        cols: 9,
        rows: 9
    },
    { // Level 27
        moves: 14,
        target1: 15000,
        target2: 30000,
        target3: 48000,
        cols: 9,
        rows: 9
    },
    { // Level 28
        moves: 13,
        target1: 16000,
        target2: 32000,
        target3: 50000,
        cols: 9,
        rows: 9
    },
    { // Level 29
        moves: 12,
        target1: 18000,
        target2: 36000,
        target3: 55000,
        cols: 9,
        rows: 9
    },
    { // Level 30 - Boss level
        moves: 15,
        target1: 20000,
        target2: 40000,
        target3: 60000,
        cols: 9,
        rows: 9
    }
];

// Player progress
class ProgressManager {
    constructor() {
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem('sugarblast_progress');
            if (data) {
                const parsed = JSON.parse(data);
                this.maxLevel = parsed.maxLevel || 1;
                this.stars = parsed.stars || {};
                this.highScores = parsed.highScores || {};
            } else {
                this._setDefaults();
            }
        } catch (e) {
            this._setDefaults();
        }
    }

    _setDefaults() {
        this.maxLevel = 1;
        this.stars = {};
        this.highScores = {};
    }

    save() {
        try {
            localStorage.setItem('sugarblast_progress', JSON.stringify({
                maxLevel: this.maxLevel,
                stars: this.stars,
                highScores: this.highScores
            }));
        } catch (e) {
            // Storage not available
        }
    }

    completeLevel(levelNum, score) {
        const level = LEVELS[levelNum - 1];
        let starsEarned = 0;
        if (score >= level.target1) starsEarned = 1;
        if (score >= level.target2) starsEarned = 2;
        if (score >= level.target3) starsEarned = 3;

        const prevStars = this.stars[levelNum] || 0;
        if (starsEarned > prevStars) {
            this.stars[levelNum] = starsEarned;
        }

        const prevHigh = this.highScores[levelNum] || 0;
        if (score > prevHigh) {
            this.highScores[levelNum] = score;
        }

        if (levelNum >= this.maxLevel && levelNum < LEVELS.length) {
            this.maxLevel = levelNum + 1;
        }

        this.save();
        return starsEarned;
    }

    getStars(levelNum) {
        return this.stars[levelNum] || 0;
    }

    isUnlocked(levelNum) {
        return levelNum <= this.maxLevel;
    }
}

const progress = new ProgressManager();
