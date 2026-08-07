/**
 * OYUN KURALI SABITLERI — react-native'e BAGLI DEGIL.
 *
 * Neden ayri dosya: `BoardEngine.js`'in ilk satiri "Pure game logic — no React,
 * no animations" diyor. AMA sabitleri `constants/game.js`'ten aliyordu ve o
 * dosyanin ilk satiri `import { Dimensions } from 'react-native'`. Yani motor
 * kendini saf ilan ediyordu ama import zinciri onu React Native'e bagliyordu:
 * duz `node` ile import edilemiyordu, dolayisiyla SINANAMIYORDU.
 *
 * 5.600 satirlik bir oyunun eslesme motoru icin tek bir test yoktu ve sebebi
 * buydu. Bu dosya, kural sabitlerini (tahta olcusu, renk sayisi, ozel sekerler,
 * puanlar) duzen sabitlerinden (piksel, ekran genisligi) ayirir.
 *
 * `game.js` bunlari YENIDEN DISA ACIYOR, yani mevcut import'larin hicbiri
 * degismedi — davranis birebir ayni.
 */

export const COLS = 9;
export const ROWS = 9;

export const CANDY_COUNT = 6;

/** Ozel seker turleri. */
export const SPECIAL = {
  NONE: 0,
  STRIPED_H: 1,
  STRIPED_V: 2,
  WRAPPED: 3,
  COLOR_BOMB: 4,
};

export const SCORE_VALUES = {
  MATCH_3: 60,
  MATCH_4: 120,
  MATCH_5: 200,
  SPECIAL_STRIPED: 150,
  SPECIAL_WRAPPED: 200,
  SPECIAL_COLOR_BOMB: 500,
  CASCADE_MULTIPLIER: 1.5,
};
