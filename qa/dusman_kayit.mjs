// ===========================================================================
// DUSMANCA KAYIT PROBU — bagimsiz olcum ajani (duzeltme ajani DEGIL).
// Hicbir sey silinmez/degistirilmez; yalnizca OLCULUR.
//
// Kosum:
//   node --import ./tests/qa_hooks.mjs qa/dusman_kayit.mjs
//
// Kaydi HAM JSON METNI olarak AsyncStorage stub'ina koyup `loadProgress()`
// cagiriyoruz -> JSON.parse dahil GERCEK yol kosuyor.
// ===========================================================================
import { __seed, __clear } from '../tests/qa_asyncstorage_stub.mjs';
import { loadProgress } from '../src/utils/storage.js';
import { settleLives, msUntilNextLife, takeLife } from '../src/utils/lives.js';
import { applyQuestEvents, ensureDailyQuests } from '../src/utils/quests.js';
import { checkUnlocks } from '../src/utils/achievements.js';
import { LEVELS } from '../src/constants/levels.js';
import { LIVES_MAX, STARTER_COINS, ACHIEVEMENT_DEFS, QUEST_POOL, COIN_PER_STAR } from '../src/constants/economy.js';

const KEY = 'sugarblast_progress';
let kirilan = 0;
let saglam = 0;

function baslik(t) { console.log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72)); }
function KIRIK(m) { kirilan++; console.log('  [KIRIK]   ' + m); }
function OK(m) { saglam++; console.log('  [SAGLAM]  ' + m); }
function BILGI(m) { console.log('  .         ' + m); }

async function yukle(hamMetin) {
  __clear();
  __seed(KEY, hamMetin);
  return loadProgress();
}

console.log('LEVELS.length =', LEVELS.length, '| LIVES_MAX =', LIVES_MAX, '| STARTER_COINS =', STARTER_COINS);

// ---------------------------------------------------------------------------
baslik('A) coins — tip zorlamasi');
{
  const vakalar = [
    ['"5"', '{"coins":"5"}'],
    ['-1', '{"coins":-1}'],
    ['1e400 (JSON.parse -> Infinity)', '{"coins":1e400}'],
    ['null', '{"coins":null}'],
    ['{}', '{"coins":{}}'],
    ['NaN yerine "NaN" metni', '{"coins":"NaN"}'],
    ['"  7  "', '{"coins":"  7  "}'],
    ['true', '{"coins":true}'],
    ['[]', '{"coins":[]}'],
    ['1e9 (tavan)', '{"coins":1000000000}'],
    ['1e15 (tavan ustu)', '{"coins":1000000000000000}'],
  ];
  for (const [ad, json] of vakalar) {
    const s = await yukle(json);
    const c = s.coins;
    const iyi = Number.isInteger(c) && c >= 0 && c <= 1e9;
    (iyi ? OK : KIRIK)(`coins:${ad} -> ${JSON.stringify(c)} (tip ${typeof c})`);
  }
}

// ---------------------------------------------------------------------------
baslik('B) maxLevel — kayittan okunuyor mu?');
{
  const vakalar = ['{"maxLevel":99}', '{"maxLevel":-3}', '{"maxLevel":"12"}',
                   '{"maxLevel":1.5}', '{"maxLevel":1e400}', '{"maxLevel":30}'];
  for (const json of vakalar) {
    const s = await yukle(json);
    const iyi = s.maxLevel === 1;
    (iyi ? OK : KIRIK)(`${json} -> maxLevel=${s.maxLevel} (beklenen 1: hicbir seviye kazanilmamis)`);
  }
}

// ---------------------------------------------------------------------------
baslik('C) ***ALANLAR-ARASI KURAL*** — tip gecerli ama OYUNDA IMKANSIZ kayit');
{
  // C1: sadece 30. seviyenin yildizi var, 1..29 hic oynanmamis.
  //     Oyun kuralinda seviye 30'a ulasmak icin 1..29 kazanilmis olmali.
  const s1 = await yukle('{"stars":{"30":3}}');
  BILGI(`stars={"30":3} -> maxLevel=${s1.maxLevel}, acik seviye ${s1.maxLevel}/${LEVELS.length}`);
  if (s1.maxLevel > 1) {
    KIRIK(`stars anahtari YAZILARAK ${s1.maxLevel}/${LEVELS.length} seviye acildi. `
      + `maxLevel kapatildi ama AYNI ISTISMAR stars/highScores uzerinden CALISIYOR.`);
  } else {
    OK('stars sicratmasi engellendi');
  }

  // C2: highScores uzerinden ayni sey
  const s2 = await yukle('{"highScores":{"29":1}}');
  BILGI(`highScores={"29":1} -> maxLevel=${s2.maxLevel}`);
  if (s2.maxLevel > 1) KIRIK(`highScores ile ${s2.maxLevel}/${LEVELS.length} seviye acildi (1 puanlik "skor" yetti)`);
  else OK('highScores sicratmasi engellendi');

  // C3: ARADAKI seviyeler bos mu? Kurali soyle: en yuksek tamamlanmis seviye N
  //     ise 1..N hepsi tamamlanmis olmali.
  const tamam = new Set([...Object.keys(s1.stars), ...Object.keys(s1.highScores)].map(Number));
  const enYuksek = Math.max(0, ...tamam);
  const eksik = [];
  for (let i = 1; i < enYuksek; i++) if (!tamam.has(i)) eksik.push(i);
  if (eksik.length > 0) {
    KIRIK(`SUREKLILIK KURALI YOK: en yuksek tamamlanmis=${enYuksek} ama ${eksik.length} seviye `
      + `(${eksik.slice(0, 5).join(',')}...) hic tamamlanmamis. Yukleme bunu KABUL ETTI.`);
  } else OK('sureklilik kurali korunuyor');

  // C4: coin miktari kazanilabilecek maksimumun USTUNDE mi?
  const teorikMax = LEVELS.length * COIN_PER_STAR[3] * 3 /* comert ust sinir */ ;
  const s4 = await yukle('{"coins":999999999,"stats":{"lifetimeCoinsEarned":0}}');
  BILGI(`coins=999999999, lifetimeCoinsEarned=0 -> coins=${s4.coins}, lifetime=${s4.stats.lifetimeCoinsEarned}`);
  if (s4.coins > s4.stats.lifetimeCoinsEarned) {
    KIRIK(`coins(${s4.coins}) > lifetimeCoinsEarned(${s4.stats.lifetimeCoinsEarned}). `
      + `"Elindeki para kazandigindan fazla olamaz" kurali HIC KONTROL EDILMIYOR `
      + `(kaba ust sinir ~${teorikMax}).`);
  } else OK('coins <= lifetimeCoinsEarned');

  // C5: yildiz var ama highScore yok / highScore var ama seviye hedefinin altinda
  const lv1 = LEVELS[0];
  const s5 = await yukle(JSON.stringify({ stars: { 1: 3 }, highScores: { 1: 1 } }));
  BILGI(`stars[1]=3 ama highScores[1]=1 (target3=${lv1.target3}) -> kabul edildi mi?`);
  if (s5.stars['1'] === 3 && s5.highScores['1'] === 1) {
    KIRIK(`3 yildiz ile skor CELISKILI: 3 yildiz ${lv1.target3} puan ister, kayitta 1 puan var. Kontrol yok.`);
  } else OK('yildiz/skor tutarliligi kontrol ediliyor');

  // C6: stats ile ilerleme celiskisi -> BEDAVA BASARIM PARASI
  const s6 = await yukle(JSON.stringify({
    stats: { lifetimeMatches: 1, lifetimeCascadesBig: 99, lifetimeColorBombs: 99,
             lifetimeCoinsEarned: 99999, bestWinStreak: 99 },
    achievements: {},
  }));
  const { newlyUnlocked, rewardCoins } = checkUnlocks(s6);
  BILGI(`uydurma stats -> checkUnlocks ${newlyUnlocked.length} basarim, ${rewardCoins} coin veriyor`);
  if (rewardCoins > 0) {
    KIRIK(`stats elle sisirilerek ${rewardCoins} coin + ${newlyUnlocked.length} basarim BEDAVA alindi `
      + `(${newlyUnlocked.map(a => a.id).join(', ')}). stats ile ilerleme CAPRAZ kontrol edilmiyor.`);
  } else OK('uydurma stats basarim vermiyor');
}

// ---------------------------------------------------------------------------
baslik('D) achievements — elle `false` yazilinca odul TEKRAR aliniyor mu?');
{
  const kayit = {
    stats: { lifetimeMatches: 500, lifetimeCascadesBig: 50, lifetimeColorBombs: 50,
             lifetimeCoinsEarned: 5000, bestWinStreak: 9 },
    achievements: Object.fromEntries(ACHIEVEMENT_DEFS.map(a => [a.id, false])),
  };
  const s = await yukle(JSON.stringify(kayit));
  BILGI(`yuklemeden sonra achievements anahtar sayisi = ${Object.keys(s.achievements).length}`);
  const r = checkUnlocks(s);
  if (r.rewardCoins > 0) {
    KIRIK(`achievements[*]=false yazildi -> ${r.newlyUnlocked.length} basarim YENIDEN aciliyor, `
      + `${r.rewardCoins} coin YENIDEN odeniyor. Bunu her seviye sonunda tekrarlanabilir `
      + `(kaydi tekrar duzenle) -> sonsuz coin.`);
  } else OK('false yazmak odulu tekrar vermiyor');

  // Ayrica: true olan bir basarim korunuyor mu? (regresyon)
  const s2 = await yukle(JSON.stringify({ ...kayit, achievements: { first_match: true } }));
  if (s2.achievements.first_match === true) OK('mesru (true) basarim korunuyor');
  else KIRIK('mesru basarim KAYBOLDU');
}

// ---------------------------------------------------------------------------
baslik('E) dailyQuests — bozuk / eksik / kotu niyetli');
{
  const vakalar = [
    ['null', '{"dailyQuests":null,"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['[]', '{"dailyQuests":[],"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['{}', '{"dailyQuests":{},"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['[{}]', '{"dailyQuests":[{}],"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['[1,2,3]', '{"dailyQuests":[1,2,3],"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['eksik alanli', '{"dailyQuests":[{"id":"win_levels","target":3}],"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['yanlis tipli', '{"dailyQuests":[{"id":1,"desc":2,"target":"3","progress":[],"reward":{},"claimed":"yes"}],"lastQuestRefreshDateStr":"2026-08-07"}'],
    ['metin', '{"dailyQuests":"abc","lastQuestRefreshDateStr":"2026-08-07"}'],
  ];
  for (const [ad, json] of vakalar) {
    const s = await yukle(json);
    const iyi = Array.isArray(s.dailyQuests) && s.dailyQuests.length === 0 && s.lastQuestRefreshDateStr === '';
    (iyi ? OK : KIRIK)(`dailyQuests:${ad} -> len=${Array.isArray(s.dailyQuests) ? s.dailyQuests.length : typeof s.dailyQuests}, tarih='${s.lastQuestRefreshDateStr}'`);
  }

  // E9 — SEKLI GECERLI ama OYUNDA IMKANSIZ gorev: uydurma id + dev odul.
  const sahte = {
    dailyQuests: [
      { id: 'para_basmaca', event: 'win', desc: 'x', target: 1, progress: 0, reward: 999999999, claimed: false },
      { id: 'para_basmaca2', event: 'win', desc: 'x', target: 1, progress: 0, reward: 999999999, claimed: false },
      { id: 'para_basmaca3', event: 'win', desc: 'x', target: 1, progress: 0, reward: 999999999, claimed: false },
    ],
    lastQuestRefreshDateStr: '2026-08-07',
  };
  const s9 = await yukle(JSON.stringify(sahte));
  BILGI(`uydurma gorev listesi yuklemeden gecti mi? len=${s9.dailyQuests.length}, tarih='${s9.lastQuestRefreshDateStr}'`);
  if (s9.dailyQuests.length === 3) {
    const { earnedCoins } = applyQuestEvents(s9, [{ type: 'win', value: 1 }]);
    if (earnedCoins > 0) {
      KIRIK(`UYDURMA GOREV ODENDI: id'ler QUEST_POOL'da YOK, reward kayittan okunuyor -> `
        + `tek "win" olayinda ${earnedCoins} coin. Havuzdaki en buyuk odul ${Math.max(...QUEST_POOL.map(q => q.reward))}.`);
    } else OK('uydurma gorev odenmedi');
  } else OK('uydurma gorev listesi elendi');

  // E10 — GERCEK id, ama odul ve hedef degistirilmis
  const s10 = await yukle(JSON.stringify({
    dailyQuests: QUEST_POOL.slice(0, 3).map(q => ({
      id: q.id, event: q.event, desc: 'x', target: 1, progress: 0, reward: 500000, claimed: false,
    })),
    lastQuestRefreshDateStr: '2026-08-07',
  }));
  if (s10.dailyQuests.length === 3) {
    const evs = [...new Set(s10.dailyQuests.map(q => q.event))].map(t => ({ type: t, value: 1 }));
    const { earnedCoins } = applyQuestEvents(s10, evs);
    if (earnedCoins > 0) KIRIK(`GERCEK id + sisirilmis reward/target -> ${earnedCoins} coin (havuz degeri ${QUEST_POOL.slice(0,3).reduce((a,q)=>a+q.reward,0)})`);
    else OK('sisirilmis odul odenmedi');
  }

  // E11 — `event` alani HIC YOK: isValidQuest bunu sormuyor -> gorevler
  //       gun boyu ILERLEMEZ (sessiz olu gun).
  const s11 = await yukle(JSON.stringify({
    dailyQuests: QUEST_POOL.slice(0, 3).map(q => ({
      id: q.id, desc: 'x', target: q.target, progress: 0, reward: q.reward, claimed: false,
    })),
    lastQuestRefreshDateStr: '2026-08-07',
  }));
  if (s11.dailyQuests.length === 3) {
    const evs = QUEST_POOL.slice(0, 3).map(q => ({ type: q.event, value: 999999 }));
    const { quests } = applyQuestEvents(s11, evs);
    const ilerleyen = quests.filter(q => q.progress > 0).length;
    if (ilerleyen === 0) {
      KIRIK(`\`event\` alani OLMAYAN gorev listesi GECERLI sayildi (isValidQuest event'i sormuyor) -> `
        + `3 gorevin 0'i ilerledi. Oyuncu o gun hicbir gorevi bitiremez, yenilenme de tetiklenmez.`);
    } else OK(`event'siz gorevler yine de ilerliyor (${ilerleyen}/3)`);
  } else {
    OK('event\'siz gorev listesi elendi');
  }
}

// ---------------------------------------------------------------------------
baslik('F) lives / lastLifeRegenMs');
{
  const now = Date.now();
  const vakalar = [
    ['lives:-5', `{"lives":-5}`],
    ['lives:999', `{"lives":999}`],
    ['lives:"3"', `{"lives":"3"}`],
    ['lives:null', `{"lives":null}`],
    ['lives:2.9', `{"lives":2.9}`],
  ];
  for (const [ad, json] of vakalar) {
    const s = await yukle(json);
    const iyi = Number.isInteger(s.lives) && s.lives >= 0 && s.lives <= LIVES_MAX;
    (iyi ? OK : KIRIK)(`${ad} -> lives=${s.lives}`);
  }
  // gelecege ayarli anchor
  const gelecek = now + 30 * 24 * 3600 * 1000;
  const s = await yukle(JSON.stringify({ lives: 0, lastLifeRegenMs: gelecek }));
  const settled = settleLives(s, now);
  const bekleme = msUntilNextLife(s, now);
  BILGI(`anchor=+30 gun -> kayitta lastLifeRegenMs=${s.lastLifeRegenMs <= now ? '<=now (kirpildi)' : 'GELECEKTE'}`);
  BILGI(`settleLives -> lives=${settled.lives} | msUntilNextLife=${(bekleme / 60000).toFixed(1)} dk`);
  if (bekleme <= 20 * 60 * 1000 + 1000 && s.lastLifeRegenMs <= now) OK('gelecek anchor kirpiliyor, bekleme <= 20 dk');
  else KIRIK(`gelecek anchor kilitliyor: bekleme ${(bekleme / 60000).toFixed(1)} dk`);

  // 0 can ile takeLife
  const s0 = await yukle(JSON.stringify({ lives: 0, lastLifeRegenMs: now }));
  const t = takeLife(s0, now);
  (t === null ? OK : KIRIK)(`lives:0 -> takeLife ${t === null ? 'null (dogru)' : JSON.stringify(t)}`);
}

// ---------------------------------------------------------------------------
baslik('G) JSON butunlugu / anahtar sapmalari');
{
  const vakalar = [
    ['tamamen bozuk JSON', '{coins: 50, '],
    ['bos metin', ''],
    ['sadece "null"', 'null'],
    ['dizi', '[1,2,3]'],
    ['sayi', '42'],
    ['metin', '"merhaba"'],
    ['bos nesne (tum anahtarlar eksik)', '{}'],
    ['fazladan anahtarlar', '{"coins":10,"__proto__x":1,"hack":true,"lives":3}'],
  ];
  for (const [ad, json] of vakalar) {
    let s, hata = null;
    try { s = await yukle(json); } catch (e) { hata = e; }
    if (hata) { KIRIK(`${ad} -> COKTU: ${hata.message}`); continue; }
    const alanlar = ['maxLevel', 'coins', 'lives', 'stars', 'highScores', 'dailyQuests', 'stats', 'achievements', 'inventory'];
    const eksik = alanlar.filter(a => s[a] === undefined);
    if (eksik.length) KIRIK(`${ad} -> eksik alan: ${eksik.join(',')}`);
    else OK(`${ad} -> saglam kayit (coins=${s.coins}, lives=${s.lives}, maxLevel=${s.maxLevel})`);
    if (ad.startsWith('fazladan') && ('hack' in s)) KIRIK('fazladan anahtar kayda SIZDI');
  }

  // prototype kirlenmesi
  const p = await yukle('{"stars":{"__proto__":{"kirli":1}},"inventory":{"__proto__":{"kirli":1}}}');
  if ({}.kirli !== undefined) KIRIK('PROTOTYPE KIRLENMESI: {}.kirli tanimli!');
  else OK('prototype kirlenmesi yok');
  BILGI(`stars anahtarlari: ${JSON.stringify(Object.keys(p.stars))}, inventory: ${JSON.stringify(Object.keys(p.inventory))}`);
}

// ---------------------------------------------------------------------------
baslik('H) inventory — bilinmeyen anahtar / sisirilmis sayi');
{
  const s = await yukle('{"inventory":{"hammer":9999,"UYDURMA_BOOSTER":9999,"__proto__":1,"shuffle":"7"}}');
  BILGI(`inventory -> ${JSON.stringify(s.inventory)}`);
  if ('UYDURMA_BOOSTER' in s.inventory) {
    KIRIK('bilinmeyen booster id kayda GIRDI (BOOSTER_DEFS ile karsilastirma yok) — UI onu gostermez, sessiz cop');
  } else OK('bilinmeyen booster elendi');
  if ((s.inventory.hammer || 0) > 100) {
    KIRIK(`hammer=${s.inventory.hammer} kabul edildi; 100 coin/adet -> ${s.inventory.hammer * 100} coinlik esya bedava`);
  } else OK('inventory sayilari makul');
}

// ---------------------------------------------------------------------------
baslik('I) gunluk giris tarihi — gelecege ayarli');
{
  const s = await yukle('{"lastLoginDateStr":"2099-12-31","loginDay":7,"coins":0}');
  BILGI(`lastLoginDateStr='${s.lastLoginDateStr}' loginDay=${s.loginDay}`);
  if (s.lastLoginDateStr === '2099-12-31') {
    KIRIK('GELECEK tarih kabul edildi -> evaluateDailyLogin daysSince<0 dondurur, oyuncu 2099\'a kadar gunluk odul ALAMAZ (kalici kilitlenme)');
  } else OK('gelecek tarih temizlendi');
}

console.log('\n' + '='.repeat(72));
console.log(`OZET: ${saglam} SAGLAM, ${kirilan} KIRIK`);
console.log('='.repeat(72));
