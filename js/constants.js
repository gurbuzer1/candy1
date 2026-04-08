// ===== GAME CONSTANTS =====

const COLS = 9;
const ROWS = 9;
const CANDY_PADDING = 4;
const SWAP_SPEED = 0.15; // seconds
const FALL_SPEED = 0.08; // seconds per cell
const MATCH_PAUSE = 0.15;
const CASCADE_DELAY = 0.05;

// Candy types
const CANDY_TYPES = {
    RED: 0,
    ORANGE: 1,
    YELLOW: 2,
    GREEN: 3,
    BLUE: 4,
    PURPLE: 5
};

const CANDY_COUNT = 6;

// Special candy types
const SPECIAL = {
    NONE: 0,
    STRIPED_H: 1, // horizontal striped
    STRIPED_V: 2, // vertical striped
    WRAPPED: 3,
    COLOR_BOMB: 4
};

// Candy color palettes (main color, highlight, shadow, outline)
const CANDY_COLORS = [
    { // RED
        main: '#ff4757',
        highlight: '#ff6b7a',
        shadow: '#c0392b',
        outline: '#a02020',
        glow: 'rgba(255, 71, 87, 0.4)',
        name: 'Red'
    },
    { // ORANGE
        main: '#ffa502',
        highlight: '#ffbe44',
        shadow: '#cc8400',
        outline: '#a06600',
        glow: 'rgba(255, 165, 2, 0.4)',
        name: 'Orange'
    },
    { // YELLOW
        main: '#ffd32a',
        highlight: '#ffe066',
        shadow: '#ccaa00',
        outline: '#998800',
        glow: 'rgba(255, 211, 42, 0.4)',
        name: 'Yellow'
    },
    { // GREEN
        main: '#2ed573',
        highlight: '#5dff9e',
        shadow: '#1ea85a',
        outline: '#158040',
        glow: 'rgba(46, 213, 115, 0.4)',
        name: 'Green'
    },
    { // BLUE
        main: '#1e90ff',
        highlight: '#54aaff',
        shadow: '#0066cc',
        outline: '#004499',
        glow: 'rgba(30, 144, 255, 0.4)',
        name: 'Blue'
    },
    { // PURPLE
        main: '#a855f7',
        highlight: '#c084fc',
        shadow: '#7c3aed',
        outline: '#5b21b6',
        glow: 'rgba(168, 85, 247, 0.4)',
        name: 'Purple'
    }
];

// Game states
const GAME_STATE = {
    IDLE: 'idle',
    SELECTED: 'selected',
    SWAPPING: 'swapping',
    SWAP_BACK: 'swap_back',
    MATCHING: 'matching',
    REMOVING: 'removing',
    FALLING: 'falling',
    REFILLING: 'refilling',
    LEVEL_COMPLETE: 'level_complete',
    LEVEL_FAILED: 'level_failed'
};

// Score values
const SCORE = {
    MATCH_3: 60,
    MATCH_4: 120,
    MATCH_5: 200,
    SPECIAL_STRIPED: 150,
    SPECIAL_WRAPPED: 200,
    SPECIAL_COLOR_BOMB: 500,
    CASCADE_MULTIPLIER: 1.5
};
