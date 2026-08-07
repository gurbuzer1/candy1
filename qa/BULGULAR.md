# Sugar Blast — QA bulgulari (2026-08-07)

Uc lens (kural · durum · akis) + bagimsiz curutme. 24 ham bulgu -> 21 dogrulandi, 3 elendi.

> **2026-08-07 aksami — KANIT KOMUTLARI DEPO YOLUNA CEVRILDI.**
> Alttaki komutlar eskiden oturuma ozel SCRATCHPAD dizininden calisiyordu
> (`.../Temp/claude/.../scratchpad`). Scratchpad silinince kanitlar
> CALISTIRILAMAZ, yani dogrulanamaz hale gelir. Problar depo icine
> (`qa/probe*.mjs`) tasinmisti; komutlar artik onlari cagiriyor. Kopyalama
> gerektiren tek komut (can kapisi) `qa/probe_can_kapisi.mjs` oldu.
>
> ⛔ **`qa/autoplay.mjs` ARTIK BOZUK BIR OLCUM ARACIDIR.** Eski frenzy
> tetikleyicisini ve olu `placeSpecials`'i tasiyor: 30 seviyenin HEPSINDE %100,
> `NOFRENZY=1` ile %0 verir. Asagida ona atifta bulunan kanit komutlari
> BULGUNUN TARIHINDEKI kirik motoru olctugu icin gecerlidir; BUGUNKU urunu
> olcmek icin **`qa/autoplay2.mjs`** kullanin (detay: `qa/autoplay.mjs` basindaki
> uyari bloku).

## [ENGEL] 4'lu/5'li/L eslesmeden dogan ozel seker TAHTAYA HIC KONMUYOR — placeSpecials olu kapi

- **dosya**: `src/engine/BoardEngine.js:246`  (lens: kural)
- **beklenen**: 4'lu eslesme -> cizgili, 5'li -> renk bombasi, L/T -> sarmal seker tahtada BELIRIR (HowToPlayModal.js:25-34 bunu birebir vaat ediyor: '4 in a row creates a Striped candy...')
- **gorulen**: determineSpecials dogru ozeli URETIYOR ({col:3,row:4,special:2}) ama placeSpecials yalnizca `newGrid[col][row] === null` ise yaziyor. Cagri sirasi GameScreen.js:466-470'te once removeAndCollapse (tum bosluklari yeni sekerle DOLDURUR, olculdu: 0 null) sonra placeSpecials. Kosul hicbir zaman saglanmiyor. 30 seviyede 300 tam otomatik oyunda eslesmeden konan ozel seker sayisi: 0. Oyunun cekirdek beceri dongusu (4'lu yap, guclu seker kazan) tamamen olu; ozel sekerler sadece %4 sansli dusus, zincir hediyesi ve frenzy ile geliyor.
- **buyukluk**: Her 4'lu ve 5'li eslesmede, yani her oyuncuyu her seviyede vuruyor. Oyun ici ogretici bu kurali aciklikla ogretiyor; oyuncu kurali uyguluyor, odul gelmiyor. Quest ('Create 5 striped candies') ve basarim ('Create 10 color bombs') sayaclari yine de artiyor — yani sayac 'yaptin' diyor, tahtada hicbir sey yok.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe1.mjs   # A/A2/A3: 'placeSpecials SONRASI tahtadaki ozel seker sayisi: 0' + node qa/autoplay.mjs 10 1,15,30 (son sutun 'eslesmeden konan ozel' = 0)
```

## [ENGEL] Color Frenzy MATEMATIKSEL OLARAK her hamlede tetikleniyor -> 30 seviyenin hepsi %100 3 yildiz

- **dosya**: `src/constants/economy.js:11`  (lens: kural)
- **beklenen**: FRENZY_THRESHOLD=14 icin dosyadaki kendi yorumu: 'esik ortalamanin USTUNDE olmali; yoksa frenzy sadece zar ile tetiklenir'. Yani ozel bir birikim anini odullendirmesi bekleniyor.
- **gorulen**: 9x9=81 hucre / 6 renk -> guvercin yuvasi ilkesi geregi en kalabalik renk HER ZAMAN >= ceil(81/6) = 14 = esik. Yani duz (ozelsiz) dolu tahtada kosul HER ZAMAN dogru. Olculdu: 2000 createBoard tahtasinin 2000'inde (%100) tetikleniyor, ortalama en kalabalik renk 17.84. GameScreen.js:344-351 her takasta bir kez calistiriyor -> 30 hamlelik seviyede 29.8 frenzy. Her frenzy ~5000 puan (cells*80 + patlayan hucre*60). Sonuc: 30 seviye x 10 oyun = 300 otomatik oyunun 300'unde 3 YILDIZ; ortalama skor target3'un 1.6x (sv.25) ile 41x (sv.1) arasinda. Frenzy kapatilinca ayni oyuncu sv.15+'ta target1'i bile %0 tutturuyor — yani seviye tablosu ne frenzy'li ne frenzy'siz oyuna gore ayarlanmis.
- **buyukluk**: Her oyuncuyu her hamlede vuruyor. 30 seviyelik ilerleme, 3 yildizli hedef sistemi, yildiz basina coin odemesi (COIN_PER_STAR) ve 'Get 3 stars on a level' / '3-star 10 different levels' gorevleri anlamsizlasiyor: hepsi ilk oynamada otomatik doluyor. Zorluk egrisi diye bir sey kalmiyor. OLCUM KALIBRE EDILDI: probe4 bilinen-iyi vakada (13/13/13/13/13/13 + 3 ozel) frenzy'nin SUSTUGUNU gosteriyor, yani %100 sonucu bozuk olcum degil.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe3.mjs 2000 && node qa/probe4.mjs && node qa/autoplay.mjs 10 1,10,20,25,30 && NOFRENZY=1 node qa/autoplay.mjs 30 15,25
```

## [ENGEL] COLOR_BOMB asla patlatilamiyor — 75 coin'lik 'Color Bomb' booster'i olu satin alma

- **dosya**: `src/engine/BoardEngine.js:58`  (lens: kural)
- **beklenen**: HowToPlayModal.js:34 ve BOOSTER_DEFS.startBomb (75 coin, ayrica 7. gun giris odulu): renk bombasi bir rengin tumunu siler. getSpecialRemovals'in COLOR_BOMB dali (BoardEngine.js:187-200) bunu uyguluyor.
- **gorulen**: findMatches, COLOR_BOMB'lu hucreyi hem yatay (satir 58) hem dikey (satir 84) dizilerden DISLIYOR; bu yuzden bomba hucresi hicbir zaman `matched` kumesine giremiyor. getSpecialRemovals ise SADECE `matched` icindeki hucrelerin ozelini calistiriyor -> COLOR_BOMB dali normal oyunda ULASILMAZ. Olcum: 300 tahta x tum komsu takaslar = eslesme ureten 5494 takas; bombanin `matched`e girme sayisi 0. Kontrol grubu (ayni kosuda CIZGILI seker) 216 kez girdi -> olcum saglam. Ek: takas-ile-aktivasyon kodu da yok (GameScreen.trySwap:276-279 yalnizca findMatches'e bakiyor) ve cekic yolu getSpecialRemovals cagirmiyor; bomba yalnizca baska bir patlamanin icinde kalarak SESSIZCE silinebiliyor.
- **buyukluk**: 75 coin oduyorsun ya da 7 gun ust uste giris yapip odul aliyorsun, tahtaya konuyor ve HICBIR SEY yapmiyor; ustelik bulundugu satir/sutunda eslesmeyi bloke eden kalici bir engel haline geliyor. Coin gercek para olmasa da odul dongusunun en pahali kalemi bu.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe7.mjs 300
```

## [ONEMLI] shuffleBoard hazir eslesme birakiyor ve karistirma sonrasi cascade isletilmiyor -> her takas 'gecerli' sayiliyor

- **dosya**: `src/engine/BoardEngine.js:311`  (lens: kural)
- **beklenen**: Karistirma sonrasi tahtada hazir eslesme olmamali (createBoard bunu wouldMatch ile garantiliyor); en azindan karistirmadan sonra kalan eslesmeler islenmeli.
- **gorulen**: shuffleBoard sadece Fisher-Yates yapiyor, eslesme kontrolu yok: 2000 tekrarda 1906'si (%95.3) hazir eslesme birakiyor, ortalama 9.6 hucre bedava. GameScreen.js:353-359 (otomatik karistirma) ve 611-618 (50 coin'lik Shuffle booster'i) karistirdiktan sonra processCascade CAGIRMIYOR. trySwap'in gecerlilik olcutu `findMatches(swapped).matched.size > 0` oldugu icin tahtada duran eslesme her takasi gecerli yapiyor: karistirma sonrasi 144 komsu takasin ortalama 138.4'u KABUL ediliyor (hamle dusuyor + puan veriliyor), gercekten yeni eslesme ureten ise sadece 26.1.
- **buyukluk**: 50 coin'lik Shuffle booster'i her kullanildiginda %95 olasilikla oluyor: oyuncu bedava puan ve 'ne takas etsem tutuyor' bir tahta aliyor. Kural bozulmasi gercek ama tek seferlik ve oyuncunun lehine; ENGEL degil ONEMLI.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe6.mjs 200 && node qa/probe2.mjs 2000   # D bolumu
```

## [KUCUK] Zincirleme patlama yok: patlamanin icinde kalan ozel seker tetiklenmeden siliniyor

- **dosya**: `src/screens/GameScreen.js:400`  (lens: kural)
- **beklenen**: Cizgili/sarmal patlamasinin sildigi hucrelerde baska bir ozel seker varsa o da patlamali (zincir).
- **gorulen**: getSpecialRemovals TEK GECIS: donen `extra` kumesi `matched`e ekleniyor ama ikinci tur calistirilmiyor (GameScreen.js:400-401). Dogrudan olcum: (4,4)'teki CIZGILI_H patlatildiginda satirdaki 9 hucre siliniyor, ayni satirdaki (7,4) CIZGILI_V'nin sutunundan yalnizca 1 hucre gidiyor (zincir olsaydi 9 olurdu). Gercek oyunda: 800 gecerli hamlede 23 kez bir ozel seker patlamadan yutuldu (hamle basina 0.029). Ayrica 100 coin'lik cekic yolu (GameScreen.js:215-229) getSpecialRemovals'i hic cagirmiyor -> cekicle vurulan ozel seker de patlamadan siliniyor.
- **buyukluk**: Yaklasik 35 hamlede bir, yani 2-3 seviyede bir oyuncunun ozel sekeri sessizce kayboluyor. Fark edilir ama oyunu durdurmuyor; ozel sekerlerin zaten cok az uretilmesi (bkz. 1. bulgu) etkisini kucultuyor.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe1.mjs   # C bolumu + node qa/probe5.mjs 40
```

## [KUCUK] 5'li dizi baska bir eslesmeyle kesisirse RENK BOMBASI yerine SARMAL veriyor

- **dosya**: `src/engine/BoardEngine.js:137`  (lens: kural)
- **beklenen**: 5 tas ayni renk tek sirada -> renk bombasi (HowToPlayModal.js:34'un vaadi ve tur standardi).
- **gorulen**: determineSpecials once L/T kesisimlerini isliyor ve kesisen HER IKI grubun tum hucrelerini `processed`e yaziyor (satir 127-129). Sonraki dongudeki `if (group.cells.every(... processed.has ...)) return;` yuzunden 5'li grup tamamen atlaniyor. T seklinde (yatay 5 + dikey 4) test: uretilen tek ozel SARMAL, renk bombasi yok.
- **buyukluk**: Su anda TEORIK: 1. bulgu yuzunden hicbir ozel seker zaten tahtaya konmuyor. 1. bulgu duzeltilir duzeltilmez canliya cikar; nadir ama oyuncunun en cok emek verdigi hamlede (5'li) yanlis odul demek.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe8.mjs
```

## [ONEMLI] Kilitli seviye kayittan aciliyor — maxLevel dogrulanmiyor, turetilmiyor

- **dosya**: `src/utils/storage.js:46`  (lens: durum)
- **beklenen**: Kabul cubugu (sugar_blast_kabul.md, satir 75-76): "Kaydedilmis ilerleme guvenilmez girdi sayilir: bozuk/elle degistirilmis kayit oyunu cokertmez ve KILITLI SEVIYEYI ACMAZ." maxLevel ya `stars`/`highScores`'tan TURETILMELI ya da en azindan `1..LEVELS.length` araligina kirpilmali.
- **gorulen**: `mergeDefaults` (storage.js:46) kaydi `{...DEFAULT_SAVE, ...saved}` ile aynen aliyor; hicbir alan tip/aralik kontrolunden gecmiyor. `{"maxLevel":999}` yuklendiginde LevelSelectScreen.js:58'in `num <= (save?.maxLevel || 1)` kurali 30/30 seviyeyi ACIYOR — kazanilmis yildiz sayisi 0 iken. `{"maxLevel":1e400}` JSON.parse ile Infinity'ye donuyor, ayni sonuc.
- **buyukluk**: Elle kayit duzenlemesi gerektirir (rootlu/jailbreakli cihaz, yedek geri yukleme, ya da Android'de `adb run-as`). Yani rastgele oyuncuyu vurmaz — AMA kabul dosyasinda ADI GECEN kriter budur ve dogrudan ihlal ediliyor. Ayrica maxLevel disaridan gelen tek ilerleme kaynagi oldugundan, ileride bulut kayit/yedek ozelligi eklenirse ayni acik dogrudan sizar.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs 2>&1 | sed -n '/B2)/,/B3)/p'
```

## [ENGEL] Bozuk kayit oyunu COKERTIYOR: dailyQuests sekli hic dogrulanmiyor, Daily Quests modali TypeError atiyor

- **dosya**: `src/components/DailyQuestsModal.js:40`  (lens: durum)
- **beklenen**: Kabul cubugu satir 75-76: bozuk/elle degistirilmis kayit "oyunu cokertmez". Gorev nesnelerinin sekli (id/desc/target/progress/reward/claimed) yuklemede dogrulanmali, tutmuyorsa gorevler yeniden uretilmeli.
- **gorulen**: storage.js:52 `out.dailyQuests = saved.dailyQuests || []` — icerik hic bakilmadan geciyor. quests.js:32 sadece IKI sey soruyor: tarih bugun mu ve `length === 3` mu. `{"dailyQuests":[1,2,3],"lastQuestRefreshDateStr":"<bugun>"}` bu kapiyi GECIYOR. Sonra DailyQuestsModal.js:40 `q.progress.toLocaleString()` -> `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`. Ayni acik eski-surum kayit seklinde de var: `progress` alani olmayan 3 gorev kabul ediliyor, applyQuestEvents progress'i NaN yapiyor ve gorev `NaN >= 3` yuzunden SONSUZA KADAR tamamlanamiyor.
- **buyukluk**: Iki yoldan gercek: (a) yarim/bozuk AsyncStorage yazimi, (b) SURUM GECISI — gorev nesnesinin sekli bir sonraki surumde degisirse (alan eklemek/adini degistirmek yeter) MEVCUT oyuncularin Daily Quests ekrani acilir acilmaz cokuyor, cunku kayit `length===3` + bugunun tarihi kapisini gecip eski sekliyle ekrana gidiyor. Migration guvenligi sifir. Not: `loadProgress`'in KENDISI cokmuyor (10 bozuk payload denendi, hepsi temiz) — cokme gorev ekraninda oluyor.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs 2>&1 | sed -n '/B3)/,/B4)/p'
```

## [KUCUK] "Next Level" can kapisini tamamen atliyor — can sistemi kazandigin surece devre disi

- **dosya**: `App.js:207`  (lens: durum)
- **beklenen**: Her seviye baslangici 1 can tuketmeli; can 0 iken yeni seviye BASLAMAMALI (LevelSelectScreen:20-28 ve handleReplayLevel:220 bu kurali uyguluyor).
- **gorulen**: handleNextLevel (App.js:207) can KONTROLU YAPMIYOR — dogrudan `setPendingLevelNum(nextNum)`. handleConfirmBoosters (App.js:127-131) `takeLife` null dondurdugunde sessizce gecip `setScreen('game')`i KOSULSUZ cagiriyor. Sonuc: 1 canla girip kazanan oyuncu "Next Level" -> Start dongusuyle can 0'da sinirsiz seviye oynuyor. Kanit kosumunda 2..5. seviyeler can=0 iken acildi.
- **buyukluk**: ELLE KAYIT DEGISIKLIGI GEREKTIRMEZ — normal oyunda her oyuncu bu yola dusuyor, ustelik en cok oynayan (kazanan) oyuncu. Can/retention sisteminin tamami baypas oluyor ve "Replay can ister, Next istemez" tutarsizligi oyuncuya rastgele gorunuyor. Para yolu olmadigi icin gelir kaybi yok; vurdugu sey pacing ve tasarim tutarliligi.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs 2>&1 | sed -n '/B7)/,/B8)/p'
```

## [KUCUK] Gunluk giris odulu cihaz saatiyle sinirsiz tekrar alinabiliyor

- **dosya**: `App.js:56`  (lens: durum)
- **beklenen**: Odul gunde bir kez. Geriye giden tarih odulu YENIDEN acmamali (monoton saat / en son odullenen tarih >= yeni tarih kontrolu).
- **gorulen**: App.js:56 tek olcut `s.lastLoginDateStr !== today` — esitSIZLIK. Tarih GERI gidince de kosul saglaniyor; daysBetween negatif dondugu icin `daysSince === 1` tutmuyor ve dal `nextDay = 1`e dusup odulu yeniden veriyor. Kanit kosumunda 2026-08-07 <-> 2026-08-06 arasinda 5 acilis = 175 coin (gun 1,1,2,1,2). Dongu sonsuz.
- **buyukluk**: Kasitli istismar icin cihaz saatini degistirmek gerekir (rootsuz cihazda bile Ayarlar'dan yapilir — klasik casual-oyun istismari). Kasitsiz vurus da var: BATIYA UCAN oyuncu tarihi geri aldiginda odulu tekrar alip streak'i 1'e dusuruyor. Booster'lar da ayni yoldan geliyor (gun 3/5/7 booster veriyor), yani sadece coin degil envanter de uretilebiliyor. Para yolu olmadigindan gelir zarari yok.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs 2>&1 | sed -n '/B5)/,/B6)/p'
```

## [ONEMLI] Gece yarisi devri yok: gunluk gorev ve gunluk giris SADECE soguk acilista degerlendiriliyor

- **dosya**: `App.js:48`  (lens: durum)
- **beklenen**: DailyQuestsModal.js:11 oyuncuya birebir soyle diyor: "Reset at midnight". Yani uygulama acikken/arka plandayken gece yarisi gecildiginde gorevler yenilenmeli ve gunluk giris modali cikmali (AppState 'active' dinleyicisi ya da dakikalik tarih kontrolu).
- **gorulen**: App.js'teki iki useEffect'in de deps dizisi bos (`}, []` satir 46 ve 72). `ensureDailyQuests` ve gunluk giris karari YALNIZCA mount aninda calisiyor. Depoda AppState hic kullanilmiyor: `grep -rn AppState src App.js index.js` -> 0 eslesme. Mevcut tek interval (satir 43-46) sadece `setMinuteTick` yapiyor, tarih kontrolu icermiyor.
- **buyukluk**: Elle kayit degisikligi gerektirmez, her oyuncuyu vurur. Mobil uygulamalar gunlerce bellekte kalir; arka plandan geri donen oyuncu dunun gorevlerini (cogu `claimed: true`) gormeye devam eder ve gunluk giris odulunu HIC gormez — uygulamayi tamamen oldurup yeniden acmadikca. Retention mekaniginin (bu urunun tek tutundurma araci) sessizce olmesi demek; ustelik ekranda yazan vaadin ("Reset at midnight") tersi.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && grep -rn "AppState" src App.js index.js; echo "AppState eslesmesi: $?  (1 = HIC YOK)"; grep -n "}, \[\]" App.js; grep -n "Reset at midnight" src/components/DailyQuestsModal.js
```

## [KUCUK] Cihaz saati geri alinirsa can rejenerasyonu kilitleniyor ve geri sayim "43220:00" gosteriyor

- **dosya**: `src/utils/lives.js:16`  (lens: durum)
- **beklenen**: `lastLifeRegenMs` gelecekte kalirsa (saat ileri alinip geri cevrilmis) anchor `now`a kirpilmali; kullanici en fazla LIFE_REGEN_MS (20 dk) beklemeli. Geri sayim hicbir zaman 20:00'i asmamali.
- **gorulen**: settleLives (lives.js:15-18) `elapsed` NEGATIF oldugunda erken donup anchor'i AYNEN birakiyor — kendini onarmiyor. `{lives:0, lastLifeRegenMs: now + 30 gun}` ile kosuldu: lives=0 kaliyor, anchor degismiyor, `msUntilNextLife` 30 gunluk deger doneruyor ve HudBar.js:25 bunu `formatMsClock` ile **43220:00** olarak basiyor (dakika alani sinirsiz). takeLife de null dondugu icin oyuncu 30 gun boyunca (LevelSelect uzerinden) hicbir seviye acamiyor.
- **buyukluk**: Kayit dosyasina dokunmadan olusur: saati ileri alip can yenileyen oyuncu (bu bir odul, ceza degil) saati duzeltir duzeltmez oyunu KENDI KENDINE KILITLER ve cikis yolu yoktur (uygulama ici sifirlama yok). Kotu RTC'yle acilip NTP ile geriye senkronlanan cihazlar da ayni tuzaga duser. Ustelik ekrandaki "43220:00" oyuncuya bunun bir hata oldugunu bile soylemez — sadece bozuk bir sayac gorur.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs 2>&1 | sed -n '/B8)/,/OZET/p'
```

## [ONEMLI] Cuzdan tipi dogrulanmiyor: metin coins toplama yerine BIRLESTIRIYOR, `1e400` Infinity uretiyor

- **dosya**: `src/utils/storage.js:46`  (lens: durum)
- **beklenen**: `coins`, `lives`, `stats.*` yuklemede sayiya zorlanmali (`Number.isFinite` + `Math.max(0, ...)`), aksi halde aritmetik sessizce bozuluyor.
- **gorulen**: mergeDefaults tipi hic kontrol etmiyor. `{"coins":"50"}` yuklenip App.js:88'deki `prev.coins + (reward?.coins || 0)` calisinca sonuc **"5025" (string)** oluyor; handleBuyBooster'in `(prev.coins||0) < def.cost` kapisi string karsilastirmasinda geciyor ve 50 coinlik oyuncu 4975 coinle cikiyor. `{"coins":1e400}` -> JSON.parse Infinity uretiyor, HUD "Infinity" basiyor. `{"coins":-999}` aynen kabul ediliyor: dukkan kilitleniyor ve kayit kendini onaramiyor. Ayni sekilde `{"maxLevel":-5}` -> 0 seviye acik, oyun tamamen oynanamaz hale geliyor.
- **buyukluk**: Teorik tarafi agir basiyor: elle duzenleme ya da bozuk yazim gerekiyor ve urunde IAP olmadigi icin coin sisirme kimseye para kaybettirmiyor. Rapora girme sebebi #1 ile ayni kok: mergeDefaults bir SEKIL birlestiricisi, DOGRULAYICI degil — ayni satir hem seviye kilidini hem cuzdani koruyor. `-999 coin` / `-5 maxLevel` yonu ise oyuncuyu kendi kaydinda kilitli birakiyor ve uygulama ici sifirlama yolu yok.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --import ./tests/qa_hooks.mjs tests/qa_lens2_probe.mjs 2>&1 | sed -n '/B4)/,/B5)/p'
```

## [ENGEL] Uygulama hic bundle olmuyor: game.js'te cift export -- her ekran oluyor

- **dosya**: `src/constants/game.js:8`  (lens: akis)
- **beklenen**: Metro/babel src/constants/game.js'i derler; HomeScreen, LevelSelectScreen, GameScreen, GameBoard, CandyCell, ProgressBar hepsi bu dosyadan import ettigi icin uygulama acilir.
- **gorulen**: Derleme SyntaxError ile duser: "`COLS` has already been exported. Exported identifiers must be unique. (8:13)". Satir 3 `export { COLS, ROWS, CANDY_COUNT, SPECIAL, SCORE_VALUES } from './kural.js'` derken satir 8/9/37/40/107 ayni isimleri TEKRAR tanimliyor. Node ESM de ayni sonucu veriyor: "Duplicate export of 'COLS'". Bu dosya 12 dosya tarafindan import ediliyor -> hicbir ekran acilmaz, expo start kirmizi ekran verir. Kirilma HEAD commit'i d28c9d6 ('Ilk testler 9/9 + mutasyon') ile girmis; onceki commit dddc36e temiz. Testler 9/9 YESIL cunku tests/ dosyalari kural.js'i DOGRUDAN import ediyor, bozuk game.js'e hic dokunmuyor.
- **buyukluk**: Maksimum. Ilk dokunustan onceki adimda oluyor -- oyuncunun %100'u, her acilista. 'Bos ekran yok' kabul maddesi ihlal degil, tamamen kirik. Kabul cubugundaki 'Ana ekran -> Seviye sec -> Oyna' akisinin hicbir adimi calismiyor.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node -e "const b=require('@babel/core'),fs=require('fs');try{b.transformSync(fs.readFileSync('src/constants/game.js','utf8'),{filename:'src/constants/game.js',presets:[['babel-preset-expo',{}]],babelrc:false,configFile:false});console.log('BABEL OK')}catch(e){console.log('BABEL ERROR:',e.message.split('\n')[0])}"
```

## [KUCUK] Hedef puan oyunun HICBIR yerinde yazmiyor -- kaybeden oyuncu neden kaybettigini olcemiyor

- **dosya**: `src/screens/GameScreen.js:785`  (lens: akis)
- **beklenen**: Kabul cubugu: 'Kaybedince oyuncu ne olduğunu anlar (hamle bitti mi, hedef mi tutmadi)'. HowToPlayModal da 'Reach the target score before you run out of moves' diyor -> o hedef sayinin gorunmesi gerek.
- **gorulen**: levelConfig.target1/2/3 hicbir yerde METIN olarak render edilmiyor. HUD sadece SCORE ve MOVES gosteriyor; ProgressBar (src/components/ProgressBar.js) sadece bar + 3 yildiz isareti ciziyor, tek bir sayi yok; LevelIntroOverlay sadece 'LEVEL N' yaziyor; Failed modali 'Out of Moves!' + 'Score: 12,340' + 'Streak reset to 0' gosteriyor. Oyuncu 12.340 puanla kaybettiginde hedefin 12.500 mu 40.000 mi oldugunu ogrenemiyor -- 'Try Again' basmali mi yoksa booster mi almali karar veremiyor. Tek kaybetme yolu hamlelerin bitmesi oldugu icin 'Out of Moves!' basligi da ayirt edici bilgi tasimiyor.
- **buyukluk**: Her kaybedilen seviyede, her oyuncuda. 30 seviyenin tamamini kapsiyor. Match-3'te 'ne kadar yaklastim' bilgisi tekrar oynama kararinin tek girdisi; onsuz Try Again korukorune.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && grep -rn "target1\|target2\|target3" src/ --include=*.js | grep -v "constants/levels.js" | grep -v "utils/storage.js"
```

## [KUCUK] Can kapisi 'Next Level' yolundan atlaniyor -- 0 canla oynanabiliyor

- **dosya**: `App.js:207`  (lens: akis)
- **beklenen**: Can 0'ken seviye baslamaz; LevelSelectScreen zaten 'Out of lives -- wait for regen or buy a refill' diyerek reddediyor ve handleReplayLevel (satir 218-221) de kontrol ediyor.
- **gorulen**: handleNextLevel (satir 207-216) can kontrolu YAPMIYOR, dogrudan pendingLevelNum set ediyor. Devaminda handleConfirmBoosters (satir 127-132) `const lifeUpd = takeLife(next); if (lifeUpd) {...}` yaziyor ama else dali YOK -- takeLife 0 canda null donuyor, sessizce yutuluyor ve satir 138 `setScreen('game')` kosulsuz calisiyor. Sonuc: son canla girdigi seviyeyi kazanan oyuncu 'Next Level' ile 0 canla oynamaya devam ediyor; ayni seviyeyi seviye listesinden secmeye kalksa reddediliyor. Ayni durumda 'Try Again' calismiyor ama 'Next Level' calisiyor.
- **buyukluk**: Ekonominin tek gecidi bu. Kazanma zinciri kuran oyuncu can sistemini tamamen bypass ediyor; ayni oyuncuya kaybettiginde 'canin yok' deniyor. Kural tutarsizligi ekranda gorunuyor (HUD 0/5 yazarken oyun devam ediyor).
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node qa/probe_can_kapisi.mjs   # takeLife(0 can) -> null; canStartLevel(0 can) -> false
```

## [ONEMLI] Shuffle booster'i tahtada temizlenmemis eslesme birakiyor (%95, ortalama 9.5 hucre)

- **dosya**: `src/screens/GameScreen.js:616`  (lens: akis)
- **beklenen**: Karistirma sonrasi tahtada hazir 3'lu kalmaz; kalirsa otomatik patlar (processCascade calisir). Match-3'un temel kurali: ekranda duran tamamlanmis dizi patlar.
- **gorulen**: handleShuffle yalnizca `setGrid(shuffleBoard(grid))` yapiyor -- processCascade cagrilmiyor, findMatches bile calismiyor. shuffleBoard (BoardEngine.js:311) hicbir kisit gozetmeden Fisher-Yates yapiyor. 2000 denemede 1901'inde (%95.0) karistirma sonrasi tahtada ortalama 9.5 hucrelik tamamlanmis eslesme duruyor ve PATLAMIYOR. Oyuncu coin ile aldigi booster'i harciyor, ekranda duran 3'luleri goruyor, hicbiri temizlenmiyor; ancak bir sonraki HERHANGI bir takasta hepsi birden patliyor (o takasa ait olmayan puan).
- **buyukluk**: Booster her kullanildiginda %95 ihtimalle. Coin ile satin alinan (BOOSTER_DEFS) bir urun; oyuncu paranin karsiligini gorsel olarak bozuk aliyor. Ayni kod yolu processCascade'deki otomatik karistirmada da kullaniliyor.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && node --input-type=module -e "import {createBoard,findMatches,removeAndCollapse,shuffleBoard} from './src/engine/BoardEngine.js'; let leaves=0,cells=0,N=2000; for(let i=0;i<N;i++){let b=createBoard();let g=0;while(findMatches(b).matched.size>0&&g++<50)b=removeAndCollapse(b,findMatches(b).matched).grid; const s=shuffleBoard(b); const m=findMatches(s).matched.size; if(m>0){leaves++;cells+=m;}} console.log('temizlenmemis eslesme:',leaves+'/'+N,'(%'+(100*leaves/N).toFixed(1)+')','ort. hucre:',(cells/leaves).toFixed(1));"
```

## [KUCUK] Seviye 30'da 'Next Level' dugmesi yalan soyluyor -- oyunu bitirme ekrani yok

- **dosya**: `App.js:209`  (lens: akis)
- **beklenen**: 30. (son) seviyeyi bitiren oyuncu bir 'oyunu bitirdin' ekrani gorur, ya da dugme 'Next Level' yerine baska bir sey yazar.
- **gorulen**: handleNextLevel: `if (nextNum > LEVELS.length) { setScreen('levels'); return; }` -- 'Next Level' yesil dugmesine basan oyuncu hicbir aciklama olmadan seviye listesine dusuyor. LEVELS.length=30 dogrulandi. Ayrica handleLevelEnd (satir 177) maxLevel'i artirmadigi icin listede de yeni bir sey acilmis gibi gorunmuyor -> oyuncu dugmenin calismadigini saniyor.
- **buyukluk**: Sadece 30. seviyeyi bitiren oyuncuyu vuruyor -- az kisi, ama tam da en yatirim yapmis kisi. Kopus tek noktada ve tek seferlik.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && sed -n '207,216p' App.js && grep -c "moves:" src/constants/levels.js && sed -n '765,769p' src/screens/GameScreen.js
```

## [KUCUK] Android geri tusu hicbir yerde tanimli degil; 7 Modal'in hicbirinde onRequestClose yok

- **dosya**: `App.js:264`  (lens: akis)
- **beklenen**: Android donanim geri tusu ekran hiyerarsisini takip eder (game -> levels -> home -> cikis) ve acik modali kapatir. RN'de Modal icin onRequestClose Android'de ZORUNLU proptur.
- **gorulen**: Depoda tek bir BackHandler yok; 7 RN Modal'in (HowToPlay, DailyLogin, DailyQuests, BoosterShop, PreGameBooster, Achievements, GameScreen'in 2 sonuc modali) hicbirinde onRequestClose tanimli degil. Sonuc: oyunun ortasinda geri tusu = uygulamadan cikis (harcanan can + o eldeki tum ilerleme gider), modal acikken geri tusu = olu tus.
- **buyukluk**: Sadece Android. Ama Android'de geri tusu birincil navigasyon; oyun ekraninda yanlislikla basmak uygulamayi kapatir ve can geri gelmez.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && grep -rn "BackHandler\|onRequestClose" src/ App.js ; echo "--- eslesme sayisi: $? (1 = HIC YOK) ---" ; grep -rn "<Modal" src/ | wc -l
```

## [ONEMLI] Oyun ortasinda '<-' tusu: uyari yok, can gider, o eldeki quest/istatistik ilerlemesi kaydedilmeden silinir

- **dosya**: `src/screens/GameScreen.js:639`  (lens: akis)
- **beklenen**: Yarim birakilan seviye icin ya onay sorulur ya da o ana kadarki quest/istatistik ilerlemesi kaydedilir.
- **gorulen**: HUD'un sol ustundeki 40x40 '<-' dugmesi dogrudan App.handleBackToLevels'i cagiriyor. endedRef hic tetiklenmedigi icin emitResult (satir 575) CALISMIYOR: sessionRef'te biriken matches, striped/wrapped sayaci, candiesByColor, bestCascadeLevel ve quest event'lerinin tamami kayboluyor. Can ise girise girerken zaten harcanmisti. Net sonuc: 1 can + tum oturum ilerlemesi, tek bir yanlis dokunusla, hicbir uyari olmadan.
- **buyukluk**: Yanlis dokunusa bagli, ama '<-' dugmesi tahtaya en yakin ust kosede ve 40px. Can 30 dakikada bir doluyor (LIFE_REGEN_MS), yani bedeli gercek.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && sed -n '638,642p' src/screens/GameScreen.js && sed -n '542,561p' src/screens/GameScreen.js && sed -n '228,231p' App.js
```

## [KUCUK] PreGameBoosterModal'da '<- Back' secimi sifirlamiyor -- sonraki seviyede booster kendiliginden harcaniyor

- **dosya**: `src/components/PreGameBoosterModal.js:73`  (lens: akis)
- **beklenen**: Modal iptal edilince secili booster'lar temizlenir; bir sonraki acilista hicbiri isaretli gelmez.
- **gorulen**: confirm() ve skip() `setSelected({})` yapiyor, ama onCancel ('<- Back', satir 73) yapmiyor. Modal App.js'te kalici olarak mount (visible prop'u ile gizleniyor), yani state korunuyor. Oyuncu 5. seviyede '+5 hamle'yi isaretleyip Back'e basip 3. seviyeyi acinca kutucuk hala isaretli geliyor ve 'Start Level'a basinca envanterden dusuluyor (App.js:120-126).
- **buyukluk**: Nadir yol (secip vazgecip baska seviye acmak), ama sonucu geri alinamaz: coin ile alinmis bir booster istemsiz harcaniyor.
- **kanit komutu**:

```
cd "C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1" && sed -n '15,30p;69,76p' src/components/PreGameBoosterModal.js && sed -n '116,126p' App.js
```


---

## Elenen (curutuldu)

- **calculateScore, cascadeLevel tanimsizsa NaN dondurur (girdi korumasi yok)** — 
- **Basarim bayragina inaniliyor: `achievements[id]=false` yazilirsa odul tekrar veriliyor** — 
- **Kilitli seviyeye dokunmak tamamen sessiz (olu dokunus)** — 
