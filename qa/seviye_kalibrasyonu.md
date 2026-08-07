# Seviye kalibrasyonu — 30 seviyenin hedefleri OLCUMLE kondu

Tarih: 2026-08-07 · Depo: `gurbuzer1_candy1` (tek kanonik kopya)

> **ZORLUK OLCULUR, TAHMIN EDILMEZ.**
> `src/constants/levels.js` bugune kadar hic olculmemisti. Ustelik yazildigi
> donemde motor kirikti (Color Frenzy her hamlede tetikleniyordu), yani
> tahminler bile sisirilmis skorlara bakiyordu. Frenzy duzeltilince
> (commit `3f90575`) tablo cifte yanlis hale geldi.

---

## 1. Araclar

| dosya | ne yapar |
|---|---|
| `qa/autoplay2.mjs` | duzeltilmis GameScreen akisini birebir taklit eden bassiz oyuncu (onceki ajan yazdi) |
| `qa/kalibrasyon.mjs` | **YENI** — tohumlu RNG + hamle sayisi parametresi + 4 oyuncu politikasi |
| `qa/hedef_uret.mjs` | **YENI** — olculen dagilimin yuzdeliklerinden 30 seviyelik tabloyu uretir |
| `qa/mutasyon_seviye.mjs` | **YENI** — yeni testin gercekten korudugunu mutasyonla sinar |
| `tests/seviye_tablosu.test.js` | **YENI** — tabloyu koruyan 8 test |

`qa/autoplay.mjs` ve `qa/autoplay2.mjs` **silinmedi**; eski/yeni akisi olcmeye
devam ediyorlar.

### Olcum aracinin kendisi dogrulandi

`kalibrasyon.mjs` bilinen-iyi vakayla (autoplay2) karsilastirildi, ayni tablo,
100 oyun:

| seviye | autoplay2 `%>=t1` | kalibrasyon `%>=t1` | autoplay2 `%>=t3` | kalibrasyon `%>=t3` |
|---|---|---|---|---|
| 1  | 100% | 100% | 100% | 100% |
| 15 |  81% |  77% |   3% |   2% |
| 25 |   3% |   2% |   0% |   0% |
| 30 |  17% |  11% |   0% |   0% |

Fark orneklem gurultusu icinde. Olcum araci uydurmuyor.

---

## 2. Otomatik oyuncu KALIBRASYONU — "bot ne kadar iyi oynuyor?"

Bot insan degil. Tek bir bot "iyi mi kotu mu" sorusunu cevaplayamaz; **alt ve
ust sinir** gerekir. Dort politika olculdu (`node qa/kalibrasyon.mjs politika 80 12,15,20,25,30`):

| politika | ne yapar | medyan / acgozlu medyani |
|---|---|---|
| `rastgele` | gecerli hamlelerden **rastgele** secer — dikkatsiz oyuncu | **0.26 – 0.59×** |
| `acgozlu` | 1 hamlelik acgozlu: en cok hucre goturen + zincir + ozel seker | **1.00×** (tablonun dayanagi) |
| `ilerikor` | zinciri **sonuna kadar planlar**, ama dusecek sekeri goremez | **1.29 – 1.72×** |
| `ileri` | dusecek sekerleri de gorur — **insan ustu** | **2.83 – 3.89×** |

Ham olcum:

```
politika  | hamle | oyun |    p25 |    p50 |    p75 |     ort | medyan orani
rastgele  |    15 |   80 |   2169 |   3207 |  10006 |    6475 | 0.33
acgozlu   |    15 |   80 |   8040 |   9833 |  15171 |   11369 | 1.00
ilerikor  |    15 |   80 |  12059 |  16943 |  25974 |   19320 | 1.72
ileri     |    15 |   80 |  29616 |  38246 |  51114 |   41634 | 3.89
rastgele  |    25 |   80 |  10370 |  12196 |  17481 |   14389 | 0.57
acgozlu   |    25 |   80 |  17108 |  21382 |  27408 |   23199 | 1.00
ilerikor  |    25 |   80 |  25327 |  31016 |  38228 |   32773 | 1.45
ileri     |    25 |   80 |  52632 |  69939 |  82232 |   71554 | 3.27
rastgele  |    30 |   80 |  11252 |  17082 |  22299 |   17468 | 0.59
acgozlu   |    30 |   80 |  21840 |  28804 |  34822 |   29162 | 1.00
ilerikor  |    30 |   80 |  33135 |  43303 |  48926 |   42619 | 1.50
ileri     |    30 |   80 |  71604 |  87952 |  97140 |   87305 | 3.05
```

**Bot rastgele takas yapmiyor** — `acgozlu` rastgele oyuncunun 1.7-3.8 katini
skorluyor, yani gercekten eslesme ureten takasi seciyor (kod: `candidateMoves`
yalnizca eslesme veya bomba ureten takaslari dondurur; `acgozlu` bunlarin
icinden en yuksek sezgisel degeri secer).

### Insan kaymasi — OLCULEN, varsayilan degil

Becerikli insan `ilerikor`'a benzer: zinciri planlar ama yukaridan hangi
sekerin dusecegini **bilemez**. `ileri` ile `ilerikor` arasindaki tek fark
degerlendirme tohumunun oyunun gercek rastgelelik akisindan ayrilmasidir;
aradaki ~2 kat, **saf ongoru avantajidir** ve hicbir insanda yoktur.

> **Kayma: becerikli insan ≈ botun 1.5 KATI (olculen: 1.29–1.72×).**
> Asagidaki tum `acgozlu` oranlari insan icin **ALT SINIRDIR**.

**Acikca varsayilan sey:** `ilerikor` politikasinin gercek bir insanin
becerisine denk oldugu **kanitlanmadi** — insan denegiyle olculmedi. Kanitlanan
sey, otomatik oyuncunun rastgele oynamadigi ve makul bir bant icinde
kaldigidir. Gercek insan verisi (telemetri) geldiginde bu carpanin
dogrulanmasi gerekir.

---

## 3. ESKI tablo — olculen hali

`node qa/kalibrasyon.mjs tablo 100` (eski `levels.js` ile), `acgozlu` bot:

```
sev | hml |     t1 /     t2 /     t3 |    p50 | %>=t1 | %>=t2 | %>=t3
  1 |  30 |   1000 /   2500 /   5000 |  28625 |  100% |  100% |  100%
  5 |  22 |   3000 /   6000 /  10000 |  19130 |  100% |  100% |   88%
 10 |  18 |   5500 /  11000 /  18000 |  15039 |   97% |   66% |   40%
 15 |  15 |   8000 /  16000 /  28000 |  10900 |   77% |   23% |    2%
 19 |  13 |  10000 /  20000 /  36000 |   9346 |   45% |   10% |    0%
 20 |  12 |  12000 /  24000 /  40000 |   8014 |   25% |    5% |    0%
 23 |  11 |  15000 /  30000 /  46000 |   4184 |   17% |    1% |    1%
 25 |  10 |  18000 /  36000 /  50000 |   3298 |    2% |    0% |    0%
 26 |  15 |  14000 /  28000 /  45000 |  10905 |   34% |    6% |    0%
 30 |  15 |  20000 /  40000 /  60000 |  11122 |   11% |    1% |    0%
```

Uc kirik:

1. **Sev 1-8 bedava** — 3 yildiz orani %100. Hedef hicbir sey olcmuyor.
2. **Ust yarida 3 yildiz IMKANSIZ** — 100 oyunluk olcumde sev 19, 20, 21, 22,
   24, 25, 26, 27, 28, 29, 30 yani **11 seviyede oran tam %0**; sev 23'te %1,
   sev 17'de %1, sev 18'de %2. Bu bir ALARM'di, kabul degil.
3. **Egri monoton degildi** — sev 25 (10 hamle / 18000 hedef, %2 gecis)
   sev 26'dan (15 hamle / 14000 hedef, %34) cok daha zordu. Sev 23'un medyani
   sev 24'unkinin altindaydi.

Kok neden: **hedef artarken hamle azaliyordu.** Skor kabaca hamleyle buyudugu
icin bu matematiksel olarak celiskiliydi. Sev 25'te 10 hamleyle 18.000 puan
isteniyordu; olculen medyan **3.298**.

---

## 4. YENI tablo nasil turetildi

`qa/hedef_uret.mjs`, kullanilan her hamle sayisi icin **400 oyunluk** skor
dagilimini olcup hedefleri o dagilimin yuzdeliklerinden turetir:

| hedef | sev 1 | → | sev 30 |
|---|---|---|---|
| `target1` | p02 | → | p45 |
| `target2` | p35 | → | p80 |
| `target3` | p70 | → | p97 |

Sonra iki kisit **zorlanir**:

* **(a)** hedefler seviyeler arasi kesin artar, `t1 < t2 < t3`;
* **(b)** **olculen gecme orani seviyeden seviyeye asla artmaz.** Sadece sayiyi
  buyutmek yetmiyordu: hamle sayisi blok basinda sicradigi icin daha buyuk bir
  hedef daha KOLAY olabiliyordu. Kosucu bu durumda hedefi 500'luk adimlarla
  yukari itiyor.

**Hamle sayisi artik ARTIYOR (20 → 36).** Zorluk hamle kisitindan degil,
hedefin dagilimdaki yerinden geliyor. Eski tablonun kirilma noktasi tam tersiydi.

Olculen dagilim (400 oyun, `acgozlu`):

| hamle | p25 | p50 | p75 |
|---|---|---|---|
| 20 | 11.459 | 18.133 | 23.422 |
| 22 | 16.053 | 19.657 | 27.120 |
| 25 | 17.575 | 23.252 | 29.663 |
| 28 | 20.667 | 27.199 | 33.204 |
| 32 | 25.937 | 31.842 | 38.840 |
| 36 | 28.389 | 35.783 | 43.978 |

---

## 5. YENI tablo — BAGIMSIZ ornekle dogrulama

Hedefleri ureten olcum tohum tabani `20260807+hamle` idi. Asagidaki dogrulama
**farkli tohumlarla** (555000+seviye) ve **seviye basina 2000 oyunla** yapildi,
yani ureten orneklem degil bagimsiz orneklem.

`node qa/kalibrasyon.mjs tablo 2000 acgozlu 555000` — sure 8dk 56sn:

```
sev | hml |     t1 /     t2 /     t3 |    p50 | %>=t1 | %>=t2 | %>=t3
  1 |  20 |   4000 /  14000 /  21500 |  17440 |   98% |   63% |   27%
  2 |  20 |   8000 /  14500 /  22000 |  17167 |   96% |   60% |   25%
  3 |  20 |   8500 /  15500 /  22500 |  17393 |   95% |   58% |   23%
  4 |  20 |   9000 /  16000 /  23000 |  17191 |   91% |   56% |   20%
  5 |  20 |   9500 /  16500 /  23500 |  17670 |   88% |   56% |   22%
  6 |  22 |  10500 /  19000 /  27000 |  19176 |   88% |   51% |   20%
  7 |  22 |  11000 /  19500 /  27500 |  18990 |   84% |   46% |   20%
  8 |  22 |  11500 /  20000 /  28000 |  19236 |   81% |   45% |   18%
  9 |  22 |  12000 /  20500 /  28500 |  19309 |   78% |   42% |   18%
 10 |  22 |  12500 /  21000 /  29000 |  19306 |   78% |   39% |   15%
 11 |  25 |  16500 /  26000 /  31500 |  21948 |   80% |   36% |   18%
 12 |  25 |  17000 /  26500 /  32000 |  22254 |   79% |   36% |   17%
 13 |  25 |  17500 /  27000 /  32500 |  22013 |   75% |   33% |   16%
 14 |  25 |  18000 /  27500 /  33000 |  21928 |   72% |   30% |   15%
 15 |  25 |  18500 /  28000 /  33500 |  22118 |   68% |   30% |   14%
 16 |  28 |  22000 /  31000 /  38500 |  26943 |   68% |   33% |   14%
 17 |  28 |  22500 /  31500 /  39000 |  26943 |   67% |   30% |   13%
 18 |  28 |  23000 /  32000 /  39500 |  26711 |   64% |   28% |   12%
 19 |  28 |  23500 /  32500 /  40000 |  26764 |   62% |   26% |   12%
 20 |  28 |  24000 /  33000 /  41000 |  26271 |   60% |   25% |   10%
 21 |  32 |  28500 /  39000 /  46500 |  31033 |   59% |   24% |   10%
 22 |  32 |  29000 /  39500 /  47000 |  31152 |   59% |   23% |   11%
 23 |  32 |  29500 /  40000 /  47500 |  30747 |   55% |   21% |    9%
 24 |  32 |  30000 /  40500 /  48500 |  30975 |   53% |   20% |    8%
 25 |  32 |  30500 /  41000 /  49000 |  30854 |   51% |   19% |    7%
 26 |  36 |  34500 /  46000 /  55000 |  35717 |   55% |   19% |    8%
 27 |  36 |  35000 /  46500 /  56000 |  36483 |   57% |   20% |    6%
 28 |  36 |  35500 /  47000 /  58000 |  36874 |   56% |   21% |    6%
 29 |  36 |  36000 /  47500 /  59000 |  35793 |   49% |   17% |    5%
 30 |  36 |  36500 /  48000 /  60000 |  36430 |   50% |   18% |    4%
```

**Hicbir seviyede 3 yildiz orani %0 degil.** En dusuk: sev 30, %4.

### Insan vekiliyle (`ilerikor`) ayni tablo

`node qa/kalibrasyon.mjs tablo 60 ilerikor 909000` — seviye basina 60 oyun
(politika pahali; ±%6 orneklem hatasi):

| sev | `%>=t1` | `%>=t2` | `%>=t3` |
|---|---|---|---|
| 1  | 100% | 87% | 68% |
| 5  |  98% | 85% | 58% |
| 10 |  98% | 83% | 50% |
| 15 |  95% | 67% | 48% |
| 20 |  92% | 72% | 43% |
| 25 |  88% | 57% | 30% |
| 30 |  87% | 63% | 18% |

Yani hedef davranis saglaniyor:

* **1 yildiz** — dikkatli oynayan cogunluk geciyor: insan vekilinde her
  seviyede **%87–100**, en zor seviyede bile %87.
* **3 yildiz** — nadir ama imkansiz degil: bot %27 → %4, insan vekili
  %68 → %18. Hicbir seviyede sifir degil.
* **Egri monoton** — hem bot hem insan vekilinde 1'den 30'a dusuyor.

### Monotonlukta durustluk notu

Egri **ureten orneklemde kurgu geregi monoton** (kisit (b) zorlaniyor).
Bagimsiz 2000 oyunluk orneklemde ise blok ici komsu seviyeler arasindaki fark
(500 puanlik adim) **olcum gurultusunun altinda kaliyor**: n=2000'de standart
hata ~%1,1 yani 2σ ≈ ±%2,2. Ornegin sev 26/27/28 icin %55/%57/%56 okundu — bu
uc seviye istatistiksel olarak **ayirt edilemez**, sirali degil. Bloklar arasi
dusus (sev 5 %88 → sev 10 %78 → sev 15 %68 → sev 20 %60 → sev 25 %51 → sev 30
%50) gurultunun cok uzerinde ve nettir.

---

## 6. Testler ve mutasyon sinavi

`tests/seviye_tablosu.test.js` — 8 test. Suite: **92/92 gecti** (onceki 84 + 8).

Test zorlugu OLCMEZ (olcum rastgeledir ve dakikalar surer); tablonun yapisal
ozelliklerini korur: hamle limiti pozitif, `t1<t2<t3`, hedefler seviyeler arasi
artiyor, **hamle sayisi geri gitmiyor**, hedefler hamle basina makul bantta.

**Mutasyon sinavi** (`node qa/mutasyon_seviye.mjs`) — 6 mutasyonun 6'si KIRMIZI,
hepsi geri alinip YESIL dogrulandi. Her mutasyon icin arama metninin 1 kez
gectigi ve `s !== o` oldugu yazdirildi:

| mutasyon | sonuc |
|---|---|
| `target1` `target2`yi gecsin | pass 89 fail 3 → KIRMIZI |
| eski hata: hamle sayisi geri gitsin (sev 26: 36→15) | pass 89 fail 3 → KIRMIZI |
| eski hata: 3 yildiz esigi ulasilmaz olsun (sev 20: 41000→200000) | pass 90 fail 2 → KIRMIZI |
| eski hata: egri geri gitsin (sev 30 < sev 29) | pass 91 fail 1 → KIRMIZI |
| hamle limiti 0 olsun | pass 89 fail 3 → KIRMIZI |
| eski hata: `target1` duvar olsun (sev 15: 18500→60000) | pass 89 fail 3 → KIRMIZI |

---

## 7. Kapsam disi / acik kalanlar

* **Insan telemetrisi yok.** 1.5× kaymasi bot politikalariyla olculdu, gercek
  oyuncuyla degil. Canli veri geldiginde dogrulanmali.
* **Booster'lar hesaba katilmadi.** Olcumler booster'siz (`+5 hamle`, cekic,
  shuffle, baslangic bombasi kullanilmadi). Booster kullanan oyuncu icin tum
  oranlar daha yuksektir; yani hedefler bu yonden de guvenli tarafta.
* **Cihazda oynanmadi.** Bu bassiz bir motor olcumu. Dokunma/animasyon/
  zamanlama kapsam disi (portfoy dersi: birim testler yesilken canli oynayista
  alti hata cikmisti).
* **`ProgressBar` yildiz isaretcisi**: sev 1'de `target1/target3` = %18,6, yani
  ilk yildiz isaretcisi cubugun cok solunda duruyor. Kusur degil ama gorsel
  olarak dengesiz; tasarim karari olarak Emre'ye birakiliyor.
* **Frenzy esigi** (`FRENZY_CHARGE_TARGET = 30`) bu turda DEGISTIRILMEDI;
  hedefler mevcut frenzy davranisiyla olculdu.
