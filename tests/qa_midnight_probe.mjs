/**
 * GECE YARISI DEVRI PROBU — QA kaniti, urunu DEGISTIRMEZ.
 *
 * Iddia: App.js:48 useEffect deps=[] -> `ensureDailyQuests` ve gunluk giris
 * karari SADECE mount aninda calisiyor. Uygulama acikken/arka planda gece
 * yarisi gecilirse gorevler yenilenmiyor, gunluk giris modali cikmiyor.
 *
 * Bu prob gercek `src/utils/quests.js` + `src/utils/storage.js` modullerini
 * duz node ile import eder ve saati oynatir.
 *
 * Kosum:
 *   node --import ./tests/qa_hooks.mjs tests/qa_midnight_probe.mjs
 */
const storage = await import('../src/utils/storage.js');
const quests = await import('../src/utils/quests.js');

const { localDateStr, daysBetween } = storage;
const { ensureDailyQuests, applyQuestEvents } = quests;

const RealDate = Date;
function setClock(iso) {
  const fixed = new RealDate(iso);
  class FakeDate extends RealDate {
    constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(fixed); }
    static now() { return fixed.getTime(); }
  }
  globalThis.Date = FakeDate;
}
function restoreClock() { globalThis.Date = RealDate; }

const line = (s) => console.log(s);

// ---------------------------------------------------------------------------
line('=== A) SEANS GECE YARISINI GECIYOR (soguk acilis YOK) ===');

// 1) Mount: 5 Agustos 23:55 -> App.js:53 ensureDailyQuests bir kez kosar
setClock('2026-08-05T23:55:00');
let s = {
  ...(await storage.loadProgress()),
  loginDay: 3,
  lastLoginDateStr: localDateStr(),   // bugun zaten claim edildi
};
s = ensureDailyQuests(s);             // <-- App.js'te bu satirin TEK cagrisi
const gun1Gorevler = s.dailyQuests.map((q) => q.id);
line(`  mount 2026-08-05 23:55 -> lastQuestRefreshDateStr=${s.lastQuestRefreshDateStr}`);
line(`  gorevler = ${JSON.stringify(gun1Gorevler)}`);

// gorevleri tamamla (oyuncu gece yatmadan hepsini bitirdi)
for (const q of s.dailyQuests) { q.progress = q.target; q.claimed = true; }

// 2) Saat 00:05'e gecti. App REMOUNT OLMADI -> App.js'in mount effect'i kosmaz.
//    Seans icinde her seviye sonunda calisan TEK gorev kodu: applyQuestEvents
//    (App.js:183). ensureDailyQuests orada YOK.
setClock('2026-08-06T00:05:00');
line(`\n  saat ilerledi -> localDateStr()=${localDateStr()}`);
const r = applyQuestEvents(s, [
  { type: 'win', value: 1 },
  { type: 'match', value: 30 },
  { type: 'special', value: 3 },
  { type: 'cascade', value: 2 },
  { type: 'colorbomb', value: 1 },
]);
line(`  App.js:183 handleLevelEnd yolu (applyQuestEvents) sonrasi:`);
line(`    gorev id'leri  = ${JSON.stringify(r.quests.map((q) => q.id))}`);
line(`    hepsi claimed  = ${r.quests.every((q) => q.claimed)}`);
line(`    kazanilan coin = ${r.earnedCoins}`);
line(`    save.lastQuestRefreshDateStr = ${s.lastQuestRefreshDateStr} (bugun ${localDateStr()})`);

// 3) Ayni saveyi ensureDailyQuests'ten gecirsek (yani bir resume/AppState
//    dinleyicisi OLSAYDI) ne olurdu?
const varsayimsal = ensureDailyQuests(s);
line(`\n  KARSILASTIRMA — resume dinleyicisi olsaydi ensureDailyQuests:`);
line(`    yeni gorev id'leri = ${JSON.stringify(varsayimsal.dailyQuests.map((q) => q.id))}`);
line(`    yeni tarih         = ${varsayimsal.lastQuestRefreshDateStr}`);
line(`    hepsi sifirlanmis  = ${varsayimsal.dailyQuests.every((q) => q.progress === 0 && !q.claimed)}`);
line(`  => Sifirlama MANTIGI VAR; seans icinde CAGIRAN YOK.`);

// ---------------------------------------------------------------------------
line('\n=== B) GUNLUK GIRIS: seans hic remount olmazsa ne olur ===');
// App.js:55-67 birebir. Oyuncu 5 Agustos'ta claim etti (loginDay=3).
// 6 ve 7 Agustos'ta uygulamayi arka plandan geri aldi (remount YOK) -> modal cikmaz.
for (const t of ['2026-08-06T09:00:00', '2026-08-07T09:00:00']) {
  setClock(t);
  line(`  ${localDateStr()} resume -> mount effect kosmaz -> DailyLoginModal GORUNMEZ (odul 0)`);
}
// 8 Agustos'ta OS uygulamayi attı, soguk acilis:
setClock('2026-08-08T09:00:00');
const today = localDateStr();
const daysSince = daysBetween(today, s.lastLoginDateStr);
let nextDay;
if (daysSince === 1 && s.loginDay > 0 && s.loginDay < 7) nextDay = s.loginDay + 1;
else nextDay = 1;
line(`  ${today} SOGUK ACILIS -> daysSince=${daysSince}, loginDay=${s.loginDay} -> pendingLoginDay=${nextDay}`);
line(`  => 3 gunluk seri ${nextDay === 1 ? 'SIFIRLANDI' : 'korundu'}; aradaki 2 gun odulsuz.`);

restoreClock();
