# Para yolu — karar: **sonsuza dek ücretsiz**

Fabrika kapısının K1 şartı, ürünün ya gerçekten satın alınabilen bir şey
sunmasını ya da **açıkça** "sonsuza dek ücretsiz" kararı verilmesini istiyor.
Ölü paywall yasak.

Karar bu oyun için **ücretsiz** — ve burada gerekçe kısa, çünkü ölçülecek pek
bir şey yok.

## Ölçülen durum (2026-08-07)

| | |
|---|---|
| Ölçülen kopya | `claude-mobile-terminal-5/workspace/gurbuzer1_candy1` · **11 commit** |
| Senkron | origin ile **0 ileri, 0 geride** · çalışma ağacı temiz |
| Paywall / ödeme izi | **0** — tek eşleşme yok |
| Ücretli API izi | **0** |
| App Store Connect | **kayıt YOK** |
| Testler | **koşum yok** |
| Son commit | **2026-05-24** |

> ⚠️ `Projects/candy1` bu kopya **değil**: 2 commit, 8 Nisan'da kalmış.
> K1 taraması bugüne kadar onu ölçüyordu.

## Neden ücretsiz

Bir eşleştirme/renk oyunu; her şey cihazda çalışıyor. Ne paywall var, ne satın
alma SDK'sı, ne ücretli servis — arananların **hiçbiri** eşleşmedi. Yani
kullanıcı başına tekrar eden maliyet yok, dolayısıyla ücret almanın maliyet
gerekçesi de yok.

Bu türde paywall'ın alışılmış yerleri "can satmak", "hamle satmak" ve "reklamsız
sürüm". Üçü de bugün yok:

- **can/hamle satmak** oyunun zorluk dengesini para karşılığı bozar
- **reklamsız sürüm** için önce reklam eklemek gerekir; reklam gizlilik beyanını
  ve yaş derecelendirmesini değiştirir — ayrı bir karardır

## Bu kararın anlamı

- Paywall ekranı **eklenmeyecek**. Sonradan eklenirse bu dosya güncellenir ve
  ürünler ASC'de ONDAN ÖNCE oluşturulur.
- Mağaza listesinde "premium", "pro", "yükselt" vaadi **olmayacak**.
- Reklam **yok** (yukarıdaki gerekçe).

## Durum: iki buçuk aydır dokunulmamış

Son commit **24 Mayıs**. ASC'de kaydı yok, test koşumu yok. K1 bu app için engel
değil ama gönderilebilir de değil, ve asıl soru para değil:

- **Bu ürün devam ediyor mu?** İki buçuk aydır dokunulmamış bir prototipe
  gönderim emeği harcamak, portföyün zaten ölçülmüş hastalığını (yarım ürün
  biriktirmek) büyütür.
- **Test koşumu yok** — fabrikanın kabul kriteri "testler koştu ve geçti" diyor.
- **K4 (dağıtım)** cevaplanmadı; eşleştirme oyunu kategorisi doymuş ve kanalsız
  bir giriş orada görünmez bile.

Bu üçü cevaplanmadan burada yapılacak doğru iş **yok**; K1 kararı yazıldı ve app
yerinde bırakıldı.

---

## 2026-08-07 — İlk testler eklendi, ve motorun "saf" olmadığı ortaya çıktı

Emre sordu: *"yeni oyun yok mu casual? multi level?"* Ölçüm şunu gösterdi:
**var, ve bu o.** 30 seviye (her biri hamle limiti + 3 yıldızlı hedef),
`LevelSelectScreen`, booster dükkânı, günlük görevler, başarımlar, günlük giriş
— 5.600 satır. Yani prototip değil, tamamlanmış bir casual match-3.

### 🔴 Ama tek bir testi yoktu — ve sebebi yapısaldı

`BoardEngine.js`'in ilk satırı *"Pure game logic — no React, no animations"*
diyor. Sabitlerini `constants/game.js`'ten alıyordu ve **o dosyanın ilk satırı**
`import { Dimensions } from 'react-native'`.

Yani motor kendini saf ilan ediyordu ama **import zinciri onu React Native'e
bağlıyordu**: düz `node` ile import edilemiyor, dolayısıyla sınanamıyordu.
Bir dosyanın kendi yorumundaki iddia, import grafiği tarafından çürütülüyordu.

**Düzeltme:** kural sabitleri (`COLS`, `ROWS`, `CANDY_COUNT`, `SPECIAL`,
`SCORE_VALUES`) `constants/kural.js`'e ayrıldı; `game.js` hepsini **yeniden dışa
açıyor**, yani mevcut import'ların hiçbiri değişmedi ve davranış birebir aynı.
Motorun tek değişikliği import satırı.

### Testler: 9/9 — ve mutasyon sınavından geçti

`tests/tahta_motoru.test.js` kural mantığını ölçüyor: tahta üretimi
(başlangıçta bedava eşleşme olmamalı), yatay/dikey üçlü, **ikilinin eşleşme
sayılmaması**, takasın saflığı, çökme sonrası tahtanın dolu kalması, puan
eğrisi ve zincir çarpanı, geçerli hamle, ipucu.

| mutasyon | sonuç |
|---|---|
| eşleşme eşiği `>= 3` → `>= 2` | 🔴 **7/9** — iki test kırmızı |
| `swapCells` kopya yerine aynı referans (saflık bozuldu) | 🔴 **8/9** — bir test kırmızı |
| orijinal geri yüklendi | ✅ **9/9**, md5 yedekle birebir |

⚠️ **Bu testler yetmez.** Portföyde ölçülmüş bir ders var: birim testler
yeşilken canlı oynayışta altı hata çıkmıştı (gerçek `PointerEvent` koşum
takımı). Burada ölçülen şey **kural mantığı**; dokunma, animasyon ve zamanlama
kapsam dışı.

### K1 değişmedi

Karar hâlâ **ücretsiz**: oyunda satın alma SDK'sı yok, `economy.js`'teki
booster/coin ekonomisi tamamen oyun içi. Asıl soru para değil, **ürünün devam
edip etmeyeceği** — ve şimdi elde ölçülmüş bir cevap var: bitmeye yakın.
