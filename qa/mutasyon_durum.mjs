/**
 * MUTASYON SINAVI — DURUM DAYANIKLILIGI duzeltmeleri.
 *
 * "Yesil suite kanit degildir." Her duzeltmeyi KASTEN bozar, `npm test`in
 * KIRMIZI olmasini bekler, dosyayi geri yukler ve YESILI dogrular.
 *
 * Kritik ayrinti: arama metninin KAC KEZ gectigi ve mutasyonun GERCEKTEN
 * uygulandigi (`s !== o`) yazdirilir. Eslesmeyen bir arama metni sessizce
 * hicbir sey yapmaz ve suite yesil kalir — bu depoda daha once tam olarak
 * bu olmustu.
 *
 * Not: "kaynak kapisi" etiketli mutasyonlar DAVRANIS degil BAGLANTI sinar
 * (React efektini/AppState dinleyicisini node icinde kosturmuyoruz).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const KOK = 'C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1';
const STORAGE = path.join(KOK, 'src/utils/storage.js');
const LIVES = path.join(KOK, 'src/utils/lives.js');
const MODAL = path.join(KOK, 'src/components/DailyQuestsModal.js');
const APP = path.join(KOK, 'App.js');

const MUTASYONLAR = [
  // --- BULGU 1: bozuk kayit ekrani cokertiyordu -------------------------
  {
    ad: 'BULGU 1 — QuestRow ham `q`yi kullansin (eski cokertici hal)',
    dosya: MODAL,
    ara: '  const { desc, target, progress, reward, claimed } = normalizeQuest(q);',
    yaz: '  const { desc, target, progress, reward, claimed } = q;',
  },
  {
    ad: 'BULGU 1 — quests dizi mi kontrolunu kaldir (eski `quests || []`)',
    dosya: MODAL,
    ara: '  const safeQuests = Array.isArray(quests) ? quests : [];',
    yaz: '  const safeQuests = quests || [];',
  },
  {
    ad: 'BULGU 1 — sanitizeQuests bozuk listeyi GECIRSIN',
    dosya: STORAGE,
    ara: '  if (!raw.every(isValidQuest)) return [];',
    yaz: '  if (false) return [];',
  },
  {
    ad: 'BULGU 1 — gorev KURALINI (progress <= target) kaldir',
    dosya: STORAGE,
    ara: '  if (q.progress > q.target) return false;',
    yaz: '  if (false) return false;',
  },

  // --- BULGU 2: kilitli seviye kayittan aciliyordu ----------------------
  {
    ad: 'BULGU 2 — maxLevel yine KAYITTAN okunsun (turetme kapali)',
    dosya: STORAGE,
    ara: '  out.maxLevel = deriveMaxLevel(out.stars, out.highScores);',
    yaz: '  out.maxLevel = raw.maxLevel === undefined ? 1 : raw.maxLevel;',
  },
  {
    ad: 'BULGU 2 — turetilen maxLevel LEVELS.length ile kirpilmasin',
    dosya: STORAGE,
    ara: '  return Math.min(LEVELS.length, Math.max(1, best + 1));',
    yaz: '  return best + 1;',
  },

  // --- BULGU 3: cuzdan tipi dogrulanmiyordu ----------------------------
  {
    ad: 'BULGU 3 — coins dogrulanmasin (metin/Infinity/negatif gecsin)',
    dosya: STORAGE,
    ara: '  out.coins = safeInt(raw.coins, STARTER_COINS, 0, 1e9);',
    yaz: '  out.coins = raw.coins === undefined ? STARTER_COINS : raw.coins;',
  },
  {
    ad: 'BULGU 3 — lives dogrulanmasin',
    dosya: STORAGE,
    ara: '  out.lives = safeInt(raw.lives, LIVES_MAX, 0, LIVES_MAX);',
    yaz: '  out.lives = raw.lives === undefined ? LIVES_MAX : raw.lives;',
  },
  {
    ad: 'BULGU 3 — stats sayiya zorlanmasin',
    dosya: STORAGE,
    ara: '    out.stats[key] = safeInt(rawStats[key], 0, 0);',
    yaz: '    out.stats[key] = rawStats[key] === undefined ? 0 : rawStats[key];',
  },

  // --- BULGU 4: gece yarisi devri yoktu --------------------------------
  {
    ad: 'BULGU 4 — needsQuestRefresh TARIHE bakmasin',
    dosya: STORAGE,
    ara: "  if (safeDateStr(save?.lastQuestRefreshDateStr) !== today) return true;",
    yaz: '  if (false) return true;',
  },
  {
    ad: 'BULGU 4 — needsQuestRefresh gorev ICERIGINE bakmasin',
    dosya: STORAGE,
    ara: '  return !quests.every(isValidQuest);',
    yaz: '  return false;',
  },
  {
    ad: 'BULGU 4 (kaynak kapisi) — AppState one gelisi degerlendirmesin',
    dosya: APP,
    ara: "      if (state === 'active') refresh();",
    yaz: '      if (false) refresh();',
  },
  {
    ad: 'BULGU 4 (kaynak kapisi) — devir efekti yine SADECE mount`ta kossun',
    dosya: APP,
    ara: '  }, [dayStr, save]);',
    yaz: '  }, []);',
  },

  // --- BULGU 5: gunluk giris odulu tekrar alinabiliyordu ---------------
  {
    ad: 'BULGU 5 — saat GERI alinca odul yine verilsin (eski esitsizlik)',
    dosya: STORAGE,
    ara: '  if (Number.isFinite(daysSince) && daysSince <= 0) {',
    yaz: '  if (Number.isFinite(daysSince) && daysSince === 0) {',
  },
  {
    ad: 'BULGU 5 (kaynak kapisi) — claim tarihi GERIYE tasisin',
    dosya: APP,
    ara: '        ? prev.lastLoginDateStr',
    yaz: '        ? dayStr',
  },

  // --- BULGU 6: saat geri alininca can rejenerasyonu kilitleniyordu ----
  {
    ad: 'BULGU 6 — anchor `now`a kirpilmasin (gelecekte kalsin)',
    dosya: LIVES,
    ara: '  return Math.min(value, now);',
    yaz: '  return value;',
  },
  {
    // ⚠️ Bu iki satir BIRLIKTE mutasyona ugratilir. Tek tek bozulduklarinda
    // digeri yine 20:00 sinirini uyguluyor (esdeger mutant, suite hakli
    // olarak yesil kaliyor). Gercek eski davranisi geri getirmek icin
    // msUntilNextLife'in TUM govdesi geri alinmali.
    ad: 'BULGU 6 — msUntilNextLife TAMAMEN eski haline donsun (iki satir birden)',
    dosya: LIVES,
    degisimler: [
      {
        ara: '  const last = normalizeAnchor(save.lastLifeRegenMs, now);',
        yaz: '  const last = save.lastLifeRegenMs || now;',
      },
      {
        ara: '  return Math.min(LIFE_REGEN_MS, Math.max(0, LIFE_REGEN_MS - elapsed));',
        yaz: '  return Math.max(0, LIFE_REGEN_MS - elapsed);',
      },
    ],
  },
];

function testKos() {
  try {
    const out = execSync('npm test', { cwd: KOK, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { cikti: out, kod: 0 };
  } catch (e) {
    return { cikti: (e.stdout || '') + (e.stderr || ''), kod: e.status ?? 1 };
  }
}
const ozet = (o) => {
  const p = /^\u2139 pass (\d+)$/m.exec(o) || /# pass (\d+)/.exec(o);
  const f = /^\u2139 fail (\d+)$/m.exec(o) || /# fail (\d+)/.exec(o);
  return `pass ${p ? p[1] : '?'} fail ${f ? f[1] : '?'}`;
};

console.log('--- 0. BASLANGIC: mutasyonsuz suite ---');
const bas = testKos();
console.log('    ', ozet(bas.cikti), '| cikis kodu', bas.kod);
if (bas.kod !== 0) {
  console.log('!!! Baslangic YESIL degil, mutasyon sinavi anlamsiz. Duruldu.');
  process.exit(1);
}

let hepsiGecti = true;
for (const m of MUTASYONLAR) {
  const o = fs.readFileSync(m.dosya, 'utf8');
  const degisimler = m.degisimler || [{ ara: m.ara, yaz: m.yaz }];
  let s = o;
  const sayimlar = [];
  for (const d of degisimler) {
    sayimlar.push(s.split(d.ara).length - 1);
    s = s.replace(d.ara, d.yaz);
  }
  const uygulandi = s !== o;
  console.log(`\n--- ${m.ad}`);
  console.log(`    dosya: ${path.basename(m.dosya)} | arama metni ${sayimlar.join(' + ')} kez gecti | mutasyon UYGULANDI (s !== o): ${uygulandi}`);
  const kacKez = Math.min(...sayimlar);
  if (sayimlar.some((n) => n !== 1)) {
    console.log(`    !!! her arama metni tam olarak 1 kez gecmeli, gelen: ${sayimlar.join(',')}`);
    hepsiGecti = false;
    if (kacKez === 0) continue;
  }
  if (!uygulandi) {
    console.log('    !!! ARAMA METNI ESLESMEDI — bu mutasyon HICBIR SEY yapmadi, sinav gecersiz.');
    hepsiGecti = false;
    continue;
  }
  try {
    fs.writeFileSync(m.dosya, s);
    const r = testKos();
    const kirmizi = r.kod !== 0;
    console.log(`    mutantla suite: ${ozet(r.cikti)} | cikis kodu ${r.kod} -> ${kirmizi ? 'KIRMIZI (dogru)' : 'YESIL (TEST KORUMUYOR!)'}`);
    if (kirmizi) {
      r.cikti.split('\n').filter((l) => /^\u2716/.test(l.trim())).slice(0, 3)
        .forEach((l) => console.log('      ' + l.trim()));
    } else {
      hepsiGecti = false;
    }
  } finally {
    fs.writeFileSync(m.dosya, o);
  }
  const geri = testKos();
  console.log(`    geri alindi -> ${ozet(geri.cikti)} | cikis kodu ${geri.kod} ${geri.kod === 0 ? '(YESIL)' : '(BOZUK KALDI!)'}`);
  if (geri.kod !== 0) hepsiGecti = false;
}

console.log(`\n=== SONUC: ${hepsiGecti ? 'TUM mutasyonlar kirmizi oldu ve geri alindi' : 'EN AZ BIR mutasyon yakalanamadi'}`);
process.exit(hepsiGecti ? 0 : 1);
