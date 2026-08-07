/**
 * SEVIYE TABLOSU — 2026-08-07'de OLCUMLE yeniden kalibre edildi.
 * (ikinci tur: 2026-08-07 aksami, "zorluk 25->26'da TERS DONUYOR" bulgusu)
 *
 * ==========================================================================
 * TUR 2 — ZORLUK EGRISI TERS DONUYORDU
 * ==========================================================================
 * Uc bagimsiz dogrulama orneklemi ayni seyi soyledi: gecme orani 25'ten 26'ya
 * ARTIYORDU (n=200 %53->%60, n=1000 %51->%57, n=300 %49->%58; ~2.7 sigma,
 * gurultu degil). Ayni sicrama 10->11, 16->17, 20->21 gecislerinde de vardi.
 *
 * KOK NEDEN: tur 1'in tablosunda hedefler her seviyede SABIT bir miktar
 * (+500) artiyordu, ama hamle sayisi 5 seviyede bir SICRIYORDU
 * (20 -> 22 -> 25 -> 28 -> 32 -> 36). Hamle sicradigi seviyede skor dagilimi
 * ~%15 yukari kayiyor, hedef ise yalnizca ~%1,5 artiyordu -> o seviye
 * KOLAYLASIYORDU. "Hedef sayisal olarak artiyor" testi bunu goremez, cunku
 * hedefin BUYUMESI zorlugun artmasi DEMEK DEGILDIR.
 *
 * TUR 2 YONTEMI (qa/skor_dagilimi.mjs + qa/hedef_kalibre2.mjs):
 *   1. Skor dagilimi seviyenin hedeflerine DEGIL yalnizca hamle sayisina
 *      bagli oldugu icin 6 farkli hamle degeri icin 4000'er oyun oynandi
 *      (tohumlu RNG, SEED=20260807; toplam 24.000 oyun, ~4 dk).
 *   2. Her seviyenin hedefi, O SEVIYENIN dagiliminda istenen gecme oranina
 *      karsilik gelen YUZDELIK olarak turetildi. Istenen egri:
 *        1 yildiz %97 -> %44 · 2 yildiz %60 -> %15 · 3 yildiz %25 -> %3.
 *   3. Sonra iki kisit ZORLANDI: (a) hedefler kesin artar,
 *      (b) OLCULEN gecme orani seviyeden seviyeye ASLA ARTMAZ.
 *   4. Sonuc bagimsiz tohumlarla dogrulandi (qa/monotonluk_dogrula.mjs).
 * Kalan koruma: `tests/seviye_tablosu.test.js` artik BOTU GERCEKTEN KOSTURUR.
 *
 * ==========================================================================
 * NEDEN DEGISTI (TUR 1)
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
 * ==========================================================================
 * TUR 1 TABLOSU — SILINMEDI, kayit icin burada duruyor.
 * ⚠️ Bu tablo "hedefler artiyor" testini GECIYORDU ama zorluk egrisi hamle
 * sicramalarinda TERS DONUYORDU (25->26, 20->21, 10->11, 16->17).
 * (moves / target1 / target2 / target3 — satir sonu: TUR 1'de olculen oranlar)
 * --------------------------------------------------------------------------
 *   1: 20 / 4000 / 14000 / 21500   (1y 98% 2y 65% 3y 31%)
 *   2: 20 / 8000 / 14500 / 22000   (1y 96% 2y 64% 3y 29%)
 *   3: 20 / 8500 / 15500 / 22500   (1y 95% 2y 62% 3y 27%)
 *   4: 20 / 9000 / 16000 / 23000   (1y 93% 2y 61% 3y 26%)
 *   5: 20 / 9500 / 16500 / 23500   (1y 90% 2y 59% 3y 25%)
 *   6: 22 / 10500 / 19000 / 27000  (1y 88% 2y 56% 3y 25%)
 *   7: 22 / 11000 / 19500 / 27500  (1y 86% 2y 53% 3y 24%)
 *   8: 22 / 11500 / 20000 / 28000  (1y 84% 2y 48% 3y 23%)
 *   9: 22 / 12000 / 20500 / 28500  (1y 82% 2y 44% 3y 21%)
 *  10: 22 / 12500 / 21000 / 29000  (1y 81% 2y 42% 3y 20%)
 *  11: 25 / 16500 / 26000 / 31500  (1y 81% 2y 42% 3y 20%)  <- TERS DONUS
 *  12: 25 / 17000 / 26500 / 32000  (1y 80% 2y 41% 3y 19%)
 *  13: 25 / 17500 / 27000 / 32500  (1y 76% 2y 40% 3y 19%)
 *  14: 25 / 18000 / 27500 / 33000  (1y 72% 2y 37% 3y 18%)
 *  15: 25 / 18500 / 28000 / 33500  (1y 69% 2y 34% 3y 16%)
 *  16: 28 / 22000 / 31000 / 38500  (1y 69% 2y 33% 3y 16%)
 *  17: 28 / 22500 / 31500 / 39000  (1y 67% 2y 31% 3y 15%)
 *  18: 28 / 23000 / 32000 / 39500  (1y 65% 2y 30% 3y 15%)
 *  19: 28 / 23500 / 32500 / 40000  (1y 65% 2y 27% 3y 14%)
 *  20: 28 / 24000 / 33000 / 41000  (1y 63% 2y 26% 3y 12%)
 *  21: 32 / 28500 / 39000 / 46500  (1y 63% 2y 25% 3y 12%)  <- TERS DONUS
 *  22: 32 / 29000 / 39500 / 47000  (1y 61% 2y 24% 3y 11%)
 *  23: 32 / 29500 / 40000 / 47500  (1y 59% 2y 23% 3y 10%)
 *  24: 32 / 30000 / 40500 / 48500  (1y 57% 2y 22% 3y  8%)
 *  25: 32 / 30500 / 41000 / 49000  (1y 56% 2y 21% 3y  8%)
 *  26: 36 / 34500 / 46000 / 55000  (1y 55% 2y 21% 3y  8%)  <- TERS DONUS
 *  27: 36 / 35000 / 46500 / 56000  (1y 53% 2y 20% 3y  6%)
 *  28: 36 / 35500 / 47000 / 58000  (1y 51% 2y 19% 3y  5%)
 *  29: 36 / 36000 / 47500 / 59000  (1y 49% 2y 18% 3y  4%)
 *  30: 36 / 36500 / 48000 / 60000  (1y 46% 2y 16% 3y  3%)
 * ==========================================================================
 *
 * Satir sonundaki yorum: TUR 2'de OLCULEN oranlar (hamle basina 4000 otomatik
 * oyun, tohumlu acgozlu bot). "1y/2y/3y" = en az 1 / 2 / 3 yildiz alan oyun
 * yuzdesi. Bu sayilar botun oranlaridir; becerikli bir insan icin ALT SINIRDIR.
 */
export const LEVELS = [
  { moves: 20, target1: 6900,  target2: 15200, target3: 22100 }, // 1y 97% 2y 60% 3y 25%
  { moves: 20, target1: 8200,  target2: 15800, target3: 22200 }, // 1y 95% 2y 58% 3y 24%
  { moves: 20, target1: 8700,  target2: 16200, target3: 22500 }, // 1y 93% 2y 57% 3y 23%
  { moves: 20, target1: 9000,  target2: 16600, target3: 22700 }, // 1y 91% 2y 55% 3y 23%
  { moves: 20, target1: 9400,  target2: 16900, target3: 22900 }, // 1y 89% 2y 54% 3y 22%
  { moves: 22, target1: 10800, target2: 19200, target3: 27700 }, // 1y 86% 2y 50% 3y 19%
  { moves: 22, target1: 10900, target2: 19300, target3: 27800 }, // 1y 85% 2y 49% 3y 18%
  { moves: 22, target1: 11200, target2: 19400, target3: 27900 }, // 1y 84% 2y 49% 3y 18%
  { moves: 22, target1: 11600, target2: 19600, target3: 28000 }, // 1y 82% 2y 47% 3y 18%
  { moves: 22, target1: 12000, target2: 19800, target3: 28100 }, // 1y 80% 2y 46% 3y 18%
  { moves: 25, target1: 17300, target2: 24700, target3: 33500 }, // 1y 77% 2y 42% 3y 15%
  { moves: 25, target1: 17400, target2: 24800, target3: 33600 }, // 1y 77% 2y 42% 3y 14%
  { moves: 25, target1: 17700, target2: 25100, target3: 33700 }, // 1y 75% 2y 41% 3y 14%
  { moves: 25, target1: 18100, target2: 25500, target3: 33800 }, // 1y 73% 2y 40% 3y 14%
  { moves: 25, target1: 18400, target2: 26000, target3: 33900 }, // 1y 71% 2y 38% 3y 14%
  { moves: 28, target1: 22000, target2: 29700, target3: 40400 }, // 1y 67% 2y 35% 3y 11%
  { moves: 28, target1: 22100, target2: 29800, target3: 40500 }, // 1y 67% 2y 35% 3y 11%
  { moves: 28, target1: 22500, target2: 30100, target3: 40600 }, // 1y 66% 2y 34% 3y 10%
  { moves: 28, target1: 23200, target2: 30500, target3: 40700 }, // 1y 64% 2y 32% 3y 10%
  { moves: 28, target1: 23700, target2: 31000, target3: 40800 }, // 1y 62% 2y 30% 3y 10%
  { moves: 32, target1: 28800, target2: 38000, target3: 49000 }, // 1y 59% 2y 27% 3y  7%
  { moves: 32, target1: 29000, target2: 38100, target3: 49100 }, // 1y 58% 2y 27% 3y  7%
  { moves: 32, target1: 29400, target2: 38400, target3: 49200 }, // 1y 57% 2y 26% 3y  7%
  { moves: 32, target1: 29800, target2: 39000, target3: 49300 }, // 1y 55% 2y 24% 3y  7%
  { moves: 32, target1: 30200, target2: 39500, target3: 49400 }, // 1y 53% 2y 22% 3y  7%
  { moves: 36, target1: 36100, target2: 46700, target3: 60000 }, // 1y 50% 2y 19% 3y  4%
  { moves: 36, target1: 36300, target2: 46800, target3: 60200 }, // 1y 49% 2y 19% 3y  4%
  { moves: 36, target1: 36800, target2: 47200, target3: 60300 }, // 1y 47% 2y 18% 3y  4%
  { moves: 36, target1: 37200, target2: 48000, target3: 60400 }, // 1y 46% 2y 16% 3y  3%
  { moves: 36, target1: 37800, target2: 48800, target3: 61300 }, // 1y 44% 2y 15% 3y  3%
];
