/**
 * MUTASYON SINAVI KOSUCUSU — "olcum altyapisinin kor noktalari" turu icin.
 *
 * ⚠️ GECEN TURUN TUZAGI: dosya CRLF, arama metni LF idi -> `replace` HIC
 * uygulanmadi, suite sessizce YESIL kaldi ve mutasyon "hayatta kaldi" diye
 * degil "olcum bozuktu" diye yesildi. Bu kosucu her mutasyon icin:
 *   1) arama metninin KAC KEZ gectigini yazar; 1 degilse sinavi GECERSIZ sayar,
 *   2) `s !== o` (mutasyonun GERCEKTEN uygulandigini) yazar,
 *   3) hedef testi kosturur, KIRMIZI bekler,
 *   4) dosyayi geri yazar, YESIL bekler.
 *
 * Kullanim: node qa/mutasyon_olcum.mjs [filtre]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Her kayit: hangi dosyada, ne aranacak, ne yazilacak, hangi test kirilmali. */
const MUTASYONLAR = [
  {
    ad: 'M6 — collapse REZERVE EDILMEMIS tahtayla kosuyor (ozel seker tahtaya konmuyor)',
    dosya: 'src/screens/GameScreen.js',
    ara: 'removeAndCollapse(workGrid, toRemove)',
    yaz: 'removeAndCollapse(currentGrid, matched)',
    test: 'tests/motor_duzeltmeleri.test.js',
  },
  {
    ad: 'M6b — reserveSpecials devre disi (ozel seker hic rezerve edilmiyor)',
    dosya: 'src/screens/GameScreen.js',
    ara: 'const reserved = specials.length > 0',
    yaz: 'const reserved = false',
    test: 'tests/motor_duzeltmeleri.test.js',
  },
  {
    ad: 'M5 — FRENZY_CHARGE_TARGET devasa (frenzy TAMAMEN olur)',
    dosya: 'src/constants/economy.js',
    ara: 'export const FRENZY_CHARGE_TARGET = 30;',
    yaz: 'export const FRENZY_CHARGE_TARGET = 999999;',
    test: 'tests/motor_duzeltmeleri.test.js',
  },
  {
    // ⚠️ Mutasyon YAPISAL testleri BILEREK gecer: 30300 hala sev 25'in
    // 30200'unden buyuk, sev 27'nin 36300'unden kucuk, t1<t2<t3 bozulmuyor,
    // hamle basina hedef bandinda. Yani ESKI dosya (bot kosturmayan hali) bu
    // mutasyonu goremezdi; yalnizca yeni "ZORLUK EGRISI" testi kirmizi yanmali.
    ad: 'M7 — seviye 26 hedefi dusurulur (zorluk egrisi 25->26 TERS DONER)',
    dosya: 'src/constants/levels.js',
    ara: '{ moves: 36, target1: 36100,',
    yaz: '{ moves: 36, target1: 30300,',
    test: 'tests/seviye_tablosu.test.js',
  },
  {
    ad: 'M8 — kaynak taramasi tek klasore daralir (dosya kaybi gorunmez olur)',
    dosya: 'tests/derlenebilirlik.test.js',
    ara: "})(join(KOK, \"src\"));",
    yaz: "})(join(KOK, \"src\", \"constants\"));",
    test: 'tests/derlenebilirlik.test.js',
  },
  {
    // ESKI CITAYI (>=25) hedefleyen mutasyon: src/utils (5 dosya) gorunmez
    // olur -> 31 yerine 26 dosya taranir. 26 >= 25 oldugu icin ESKI test
    // YESIL kalirdi; sabitlenmis liste KIRMIZI yanmali.
    ad: 'M8b — src/utils taramadan dusuyor (5 dosya kayip, ESKI cita >=25 yine gecerdi)',
    dosya: 'tests/derlenebilirlik.test.js',
    ara: 'if (!/node_modules|\\.git/.test(yol)) tara(yol);',
    yaz: 'if (!/node_modules|\\.git|utils/.test(yol)) tara(yol);',
    test: 'tests/derlenebilirlik.test.js',
  },
  {
    // Ikinci hamle-siniri (10->11). Yine yapisal testleri gecer: 12100 > sev
    // 10'un 12000'i, < sev 12'nin 17400'u, hamle basina 484 puan (bantta).
    ad: 'M9 — seviye 11 hedefi dusurulur (zorluk egrisi 10->11 TERS DONER)',
    dosya: 'src/constants/levels.js',
    ara: '{ moves: 25, target1: 17300,',
    yaz: '{ moves: 25, target1: 12100,',
    test: 'tests/seviye_tablosu.test.js',
  },
  {
    // KONTROL VAKASI: "ozelligi tamamen oldurmek" de yesil gecmemeli.
    // Son seviyenin hedefini ULASILAMAZ yapmak gecme oranini %0'a indirir ve
    // %0 kusursuz MONOTONdur -> yalnizca monotonluk assert'i bunu goremez.
    // Kontrol assert'leri (sev 30 >= %20, 3 yildiz > 0) yakalamali.
    ad: 'M10 — son seviye ULASILAMAZ (egri "monoton" kalir ama oyun olur)',
    dosya: 'src/constants/levels.js',
    ara: '{ moves: 36, target1: 37800, target2: 48800, target3: 61300 }',
    // Degerler YAPISAL bandin ICINDE secildi (t1 64000/36 = 1778 <= 1800 citasi,
    // t3 100000/36 = 2778 <= 3000 citasi) ki yalnizca DAVRANIS testi konussun.
    yaz: '{ moves: 36, target1: 64000, target2: 70000, target3: 100000 }',
    test: 'tests/seviye_tablosu.test.js',
  },
];

const filtre = process.argv[2];
let gecersiz = 0;
let hayattaKalan = 0;

for (const m of MUTASYONLAR) {
  if (filtre && !m.ad.includes(filtre)) continue;
  const yol = path.join(KOK, m.dosya);
  const o = readFileSync(yol, 'utf8');

  // 1) arama metni KAC KEZ geciyor?
  const kac = o.split(m.ara).length - 1;
  console.log(`\n=== ${m.ad}`);
  console.log(`    dosya      : ${m.dosya}`);
  console.log(`    arama metni: ${JSON.stringify(m.ara)}`);
  console.log(`    GECIS SAYISI = ${kac}   ${kac === 1 ? '(gecerli)' : '(GECERSIZ — 1 olmali)'}`);
  if (kac !== 1) { gecersiz++; continue; }

  // 2) mutasyon UYGULANDI mi?
  const s = o.split(m.ara).join(m.yaz);
  console.log(`    s !== o    = ${s !== o}`);
  if (s === o) { gecersiz++; continue; }

  let kirmizi = false;
  let yesil = false;
  try {
    writeFileSync(yol, s);
    try {
      execSync(`node --test ${m.test}`, { cwd: KOK, stdio: 'pipe' });
    } catch (e) {
      kirmizi = true;
      const cikti = String(e.stdout || '') + String(e.stderr || '');
      const satir = cikti.split('\n')
        .filter((l) => /(tests|pass|fail)\s+\d+\s*$/.test(l.replace(/\r/g, '')))
        .map((l) => l.replace(/[^\x20-\x7e]/g, '').trim())
        .join(' | ');
      const kirilan = cikti.split('\n')
        .filter((l) => /^[✖x]\s|not ok \d/.test(l.trim()))
        .map((l) => l.replace(/[^\x20-\x7e]/g, '').trim())
        .slice(0, 4);
      console.log(`    MUTANT     : ${satir.trim()}`);
      kirilan.forEach((l) => console.log(`    KIRILAN    : ${l}`));
    }
  } finally {
    writeFileSync(yol, o);
    console.log(`    geri yazildi, dosya ayni mi: ${readFileSync(yol, 'utf8') === o}`);
  }
  try {
    execSync(`node --test ${m.test}`, { cwd: KOK, stdio: 'pipe' });
    yesil = true;
  } catch (e) {
    console.log('    ⚠️ GERI ALINDIKTAN SONRA HALA KIRMIZI:', String(e.stdout || '').split('\n').slice(-25).join('\n'));
  }

  console.log(`    SONUC      : mutant ${kirmizi ? 'OLDU (KIRMIZI)' : 'HAYATTA KALDI (yesil)'} | geri alinca ${yesil ? 'YESIL' : 'KIRMIZI'}`);
  if (!kirmizi) hayattaKalan++;
}

console.log(`\nGECERSIZ SINAV: ${gecersiz} | HAYATTA KALAN MUTANT: ${hayattaKalan}`);
process.exit(gecersiz + hayattaKalan > 0 ? 1 : 0);
