/**
 * SEVIYE TABLOSU — 2026-08-07'de OLCUMLE yeniden kalibre edildi.
 *
 * ==========================================================================
 * NEDEN DEGISTI
 * ==========================================================================
 * Asagidaki ESKI tablo hicbir zaman olculmemisti; tahminle yazilmisti. Ustelik
 * yazildigi donemde motor KIRIKTI (Color Frenzy her hamlede tetikleniyordu,
 * bkz. economy.js FRENZY_THRESHOLD aciklamasi) — yani tahminler bile kirik
 * mekanigin sisirdigi skorlara bakiyordu. Frenzy duzeltilince tablo cifte
 * yanlis hale geldi.
 *
 * OLCUM (qa/kalibrasyon.mjs, seviye basina 400 tam otomatik oyun, tohumlu RNG),
 * ESKI tablo:
 *   sev  1 : 3 yildiz orani %100  (hedef anlamsiz — bedava)
 *   sev 15 : 3 yildiz orani   %2
 *   sev 19-30 : 3 yildiz orani %0  -> 12 seviyede UCUNCU YILDIZ ALINAMIYORDU
 *   sev 25 : hedef1 18000 isteniyordu, olculen medyan skor 3298 (%2 gecis)
 * Ayrica egri MONOTON DEGILDI: sev 25 (10 hamle) sev 26'dan (15 hamle) cok
 * daha zordu, sev 23'un medyani sev 24'unkinin altindaydi.
 *
 * ==========================================================================
 * YENI TABLO NASIL TURETILDI
 * ==========================================================================
 * qa/hedef_uret.mjs, her hamle sayisi icin 400 oyunluk skor DAGILIMINI olcup
 * hedefleri o dagilimin YUZDELIKLERINDEN turetir:
 *   target1 : p02 (sev 1)  -> p45 (sev 30)
 *   target2 : p35          -> p80
 *   target3 : p70          -> p97
 * Sonra iki kisit ZORLANIR:
 *   (a) hedefler seviyeler arasi KESIN artar (t1<t2<t3 ve seviye>seviye-1),
 *   (b) OLCULEN gecme orani seviyeden seviyeye ASLA ARTMAZ — yani zorluk
 *       gercekten monoton. (Sadece sayiyi buyutmek yetmez: hamle sayisi da
 *       arttigi icin buyuk hedef daha KOLAY olabiliyordu.)
 *
 * HAMLE SAYISI NEDEN ARTIYOR (20 -> 36)?
 * Skor kabaca hamle sayisiyla buyuyor. Hedeflerin sayisal olarak artmasi
 * istendigi halde hamlenin azalmasi matematiksel olarak celiskiliydi; eski
 * tablonun kirilma noktasi tam buydu (sev 25: 10 hamle, 18000 hedef).
 * Zorluk artik hamle KISITINDAN degil, hedefin dagilimdaki YERINDEN geliyor.
 *
 * ==========================================================================
 * OTOMATIK OYUNCU KALIBRASYONU (insan kaymasi)
 * ==========================================================================
 * Yuzdelikler "acgozlu" botun dagilimindan okunuyor. Bot insan DEGIL, o yuzden
 * dort politika olculdu (qa/kalibrasyon.mjs politika, 80 oyun x 5 hamle sayisi):
 *   rastgele : gecerli hamlelerden rastgele              -> medyan 0.26-0.59x
 *   acgozlu  : 1 hamlelik acgozlu (tablonun dayanagi)     -> medyan 1.00x
 *   ilerikor : zinciri planlar, DUSECEK sekeri goremez    -> medyan 1.29-1.72x
 *   ileri    : dusecek sekeri de gorur (INSAN USTU)       -> medyan 2.83-3.89x
 * Becerikli bir insan "ilerikor" civaridir: bot medyaninin ~1.5 KATI. Yani
 * asagidaki oranlar insan icin ALT SINIRDIR; ayni hedef insanda daha yuksek
 * gecis verir. Olculen dogrulama qa/seviye_kalibrasyonu.md dosyasinda.
 *
 * ==========================================================================
 * ESKI TABLO — SILINMEDI, kayit icin burada duruyor.
 * (moves / target1 / target2 / target3)
 * --------------------------------------------------------------------------
 *   1: 30 / 1000 / 2500 / 5000        16: 14 / 8500 / 17000 / 30000
 *   2: 28 / 1500 / 3500 / 6000        17: 14 / 9000 / 18000 / 32000
 *   3: 25 / 2000 / 4000 / 7000        18: 13 / 9500 / 19000 / 34000
 *   4: 25 / 2500 / 5000 / 8000        19: 13 / 10000 / 20000 / 36000
 *   5: 22 / 3000 / 6000 / 10000       20: 12 / 12000 / 24000 / 40000
 *   6: 22 / 3500 / 7000 / 12000       21: 12 / 13000 / 26000 / 42000
 *   7: 20 / 4000 / 8000 / 14000       22: 12 / 14000 / 28000 / 44000
 *   8: 20 / 4500 / 9000 / 15000       23: 11 / 15000 / 30000 / 46000
 *   9: 18 / 5000 / 10000 / 16000      24: 11 / 16000 / 32000 / 48000
 *  10: 18 / 5500 / 11000 / 18000      25: 10 / 18000 / 36000 / 50000
 *  11: 18 / 6000 / 12000 / 20000      26: 15 / 14000 / 28000 / 45000
 *  12: 16 / 6500 / 13000 / 22000      27: 14 / 15000 / 30000 / 48000
 *  13: 16 / 7000 / 14000 / 24000      28: 13 / 16000 / 32000 / 50000
 *  14: 15 / 7500 / 15000 / 26000      29: 12 / 18000 / 36000 / 55000
 *  15: 15 / 8000 / 16000 / 28000      30: 15 / 20000 / 40000 / 60000
 * ==========================================================================
 *
 * Satir sonundaki yorum: OLCULEN oranlar (400 otomatik oyun, acgozlu bot)
 * "1y/2y/3y" = en az 1 / 2 / 3 yildiz alan oyun yuzdesi.
 */
export const LEVELS = [
  { moves: 20, target1: 4000,  target2: 14000, target3: 21500 }, // 1y 98% 2y 65% 3y 31%
  { moves: 20, target1: 8000,  target2: 14500, target3: 22000 }, // 1y 96% 2y 64% 3y 29%
  { moves: 20, target1: 8500,  target2: 15500, target3: 22500 }, // 1y 95% 2y 62% 3y 27%
  { moves: 20, target1: 9000,  target2: 16000, target3: 23000 }, // 1y 93% 2y 61% 3y 26%
  { moves: 20, target1: 9500,  target2: 16500, target3: 23500 }, // 1y 90% 2y 59% 3y 25%
  { moves: 22, target1: 10500, target2: 19000, target3: 27000 }, // 1y 88% 2y 56% 3y 25%
  { moves: 22, target1: 11000, target2: 19500, target3: 27500 }, // 1y 86% 2y 53% 3y 24%
  { moves: 22, target1: 11500, target2: 20000, target3: 28000 }, // 1y 84% 2y 48% 3y 23%
  { moves: 22, target1: 12000, target2: 20500, target3: 28500 }, // 1y 82% 2y 44% 3y 21%
  { moves: 22, target1: 12500, target2: 21000, target3: 29000 }, // 1y 81% 2y 42% 3y 20%
  { moves: 25, target1: 16500, target2: 26000, target3: 31500 }, // 1y 81% 2y 42% 3y 20%
  { moves: 25, target1: 17000, target2: 26500, target3: 32000 }, // 1y 80% 2y 41% 3y 19%
  { moves: 25, target1: 17500, target2: 27000, target3: 32500 }, // 1y 76% 2y 40% 3y 19%
  { moves: 25, target1: 18000, target2: 27500, target3: 33000 }, // 1y 72% 2y 37% 3y 18%
  { moves: 25, target1: 18500, target2: 28000, target3: 33500 }, // 1y 69% 2y 34% 3y 16%
  { moves: 28, target1: 22000, target2: 31000, target3: 38500 }, // 1y 69% 2y 33% 3y 16%
  { moves: 28, target1: 22500, target2: 31500, target3: 39000 }, // 1y 67% 2y 31% 3y 15%
  { moves: 28, target1: 23000, target2: 32000, target3: 39500 }, // 1y 65% 2y 30% 3y 15%
  { moves: 28, target1: 23500, target2: 32500, target3: 40000 }, // 1y 65% 2y 27% 3y 14%
  { moves: 28, target1: 24000, target2: 33000, target3: 41000 }, // 1y 63% 2y 26% 3y 12%
  { moves: 32, target1: 28500, target2: 39000, target3: 46500 }, // 1y 63% 2y 25% 3y 12%
  { moves: 32, target1: 29000, target2: 39500, target3: 47000 }, // 1y 61% 2y 24% 3y 11%
  { moves: 32, target1: 29500, target2: 40000, target3: 47500 }, // 1y 59% 2y 23% 3y 10%
  { moves: 32, target1: 30000, target2: 40500, target3: 48500 }, // 1y 57% 2y 22% 3y  8%
  { moves: 32, target1: 30500, target2: 41000, target3: 49000 }, // 1y 56% 2y 21% 3y  8%
  { moves: 36, target1: 34500, target2: 46000, target3: 55000 }, // 1y 55% 2y 21% 3y  8%
  { moves: 36, target1: 35000, target2: 46500, target3: 56000 }, // 1y 53% 2y 20% 3y  6%
  { moves: 36, target1: 35500, target2: 47000, target3: 58000 }, // 1y 51% 2y 19% 3y  5%
  { moves: 36, target1: 36000, target2: 47500, target3: 59000 }, // 1y 49% 2y 18% 3y  4%
  { moves: 36, target1: 36500, target2: 48000, target3: 60000 }, // 1y 46% 2y 16% 3y  3%
];
