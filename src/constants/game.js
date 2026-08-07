// Kural sabitleri kural.js'e tasindi (react-native'siz, sinanabilir olsun diye);
// buradan YENIDEN DISA ACILIYOR, boylece mevcut import'larin hicbiri degismedi.
export { COLS, ROWS, CANDY_COUNT, SPECIAL, SCORE_VALUES } from './kural.js';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const COLS = 9;
export const ROWS = 9;

// Calculate cell size based on screen width with padding
const BOARD_PADDING = 8;
export const CELL_SIZE = Math.floor((SCREEN_WIDTH - BOARD_PADDING * 2) / COLS);
export const BOARD_WIDTH = CELL_SIZE * COLS;
export const BOARD_HEIGHT = CELL_SIZE * ROWS;
export const BOARD_OFFSET_X = Math.floor((SCREEN_WIDTH - BOARD_WIDTH) / 2);

export const CANDY_SIZE = CELL_SIZE - 6;
export const CANDY_BORDER_RADIUS = CANDY_SIZE * 0.25;

// Animation durations (ms)
export const SWAP_DURATION = 200;
export const FALL_DURATION = 150; // per cell
export const REMOVE_DURATION = 200;
export const BOUNCE_DURATION = 300;

// Candy types
export const CANDY_TYPES = {
  RED: 0,
  ORANGE: 1,
  YELLOW: 2,
  GREEN: 3,
  BLUE: 4,
  PURPLE: 5,
};

export const CANDY_COUNT = 6;

// Special types
export const SPECIAL = {
  NONE: 0,
  STRIPED_H: 1,
  STRIPED_V: 2,
  WRAPPED: 3,
  COLOR_BOMB: 4,
};

// Candy visual configs
export const CANDY_COLORS = [
  { // RED
    bg: '#ff4757',
    highlight: '#ff6b7a',
    shadow: '#c0392b',
    border: '#a02020',
    glow: 'rgba(255, 71, 87, 0.5)',
    emoji: '🔴',
    shape: 'circle',
  },
  { // ORANGE
    bg: '#ffa502',
    highlight: '#ffbe44',
    shadow: '#cc8400',
    border: '#a06600',
    glow: 'rgba(255, 165, 2, 0.5)',
    emoji: '🟠',
    shape: 'diamond',
  },
  { // YELLOW
    bg: '#ffd32a',
    highlight: '#ffe066',
    shadow: '#ccaa00',
    border: '#998800',
    glow: 'rgba(255, 211, 42, 0.5)',
    emoji: '🟡',
    shape: 'square',
  },
  { // GREEN
    bg: '#2ed573',
    highlight: '#5dff9e',
    shadow: '#1ea85a',
    border: '#158040',
    glow: 'rgba(46, 213, 115, 0.5)',
    emoji: '🟢',
    shape: 'triangle',
  },
  { // BLUE
    bg: '#1e90ff',
    highlight: '#54aaff',
    shadow: '#0066cc',
    border: '#004499',
    glow: 'rgba(30, 144, 255, 0.5)',
    emoji: '🔵',
    shape: 'hexagon',
  },
  { // PURPLE
    bg: '#a855f7',
    highlight: '#c084fc',
    shadow: '#7c3aed',
    border: '#5b21b6',
    glow: 'rgba(168, 85, 247, 0.5)',
    emoji: '🟣',
    shape: 'star',
  },
];

// Score values
export const SCORE_VALUES = {
  MATCH_3: 60,
  MATCH_4: 120,
  MATCH_5: 200,
  SPECIAL_STRIPED: 150,
  SPECIAL_WRAPPED: 200,
  SPECIAL_COLOR_BOMB: 500,
  CASCADE_MULTIPLIER: 1.5,
};

// Theme colors
export const THEME = {
  bg1: '#1a0533',
  bg2: '#2d1b69',
  bg3: '#0d021a',
  accent: '#ff6bcb',
  accent2: '#ffd700',
  textPrimary: '#ffffff',
  textSecondary: '#b388ff',
  success: '#00c853',
  danger: '#ff4757',
  boardBg: 'rgba(0,0,0,0.3)',
  cellLight: 'rgba(255,255,255,0.06)',
  cellDark: 'rgba(255,255,255,0.03)',
};
