/**
 * MUTASYON SINAVI — tests/seviye_tablosu.test.js gercekten koruyor mu?
 *
 * "Yesil suite kanit degildir." Bu kosucu levels.js'i KASTEN bozar, `npm test`in
 * KIRMIZI oldugunu gorur, dosyayi geri yukler ve YESILI dogrular.
 *
 * Mutasyonlarin her biri, ESKI tablonun gercekten yaptigi bir hatayi taklit
 * eder (hamlenin azalmasi, ulasilamaz 3 yildiz esigi, geri giden egri) —
 * yani test "bu hata bir daha girerse yakalanir mi" sorusunu cevaplar.
 *
 * Kritik ayrinti: arama metninin KAC KEZ gectigi ve mutasyonun gercekten
 * uygulandigi (`s !== o`) yazdirilir. Bu depoda daha once eslesmeyen bir arama
 * metni sessizce hicbir sey yapmadi ve suite yesil kaldi.
 * NOT: levels.js CRLF olabilir -> arama metinleri TEK SATIR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const KOK = 'C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1';
const SEVIYE = path.join(KOK, 'src/constants/levels.js');

const MUTASYONLAR = [
  {
    ad: 'target1 target2yi GECSIN (yildizlar birbirini gecsin)',
    ara: '  { moves: 25, target1: 17000, target2: 26500, target3: 32000 },',
    yaz: '  { moves: 25, target1: 27000, target2: 26500, target3: 32000 },',
  },
  {
    ad: 'ESKI HATA — hamle sayisi geri gitsin (sev 26: 36 -> 15)',
    ara: '  { moves: 36, target1: 34500, target2: 46000, target3: 55000 },',
    yaz: '  { moves: 15, target1: 34500, target2: 46000, target3: 55000 },',
  },
  {
    ad: 'ESKI HATA — 3 yildiz esigi ULASILMAZ olsun (sev 20: 41000 -> 200000)',
    ara: '  { moves: 28, target1: 24000, target2: 33000, target3: 41000 },',
    yaz: '  { moves: 28, target1: 24000, target2: 33000, target3: 200000 },',
  },
  {
    ad: 'ESKI HATA — egri geri gitsin (sev 30 hedefleri sev 29un altina)',
    ara: '  { moves: 36, target1: 36500, target2: 48000, target3: 60000 },',
    yaz: '  { moves: 36, target1: 20000, target2: 40000, target3: 50000 },',
  },
  {
    ad: 'hamle limiti sifir olsun (sev 1)',
    ara: '  { moves: 20, target1: 4000,  target2: 14000, target3: 21500 },',
    yaz: '  { moves: 0, target1: 4000,  target2: 14000, target3: 21500 },',
  },
  {
    ad: 'ESKI HATA — target1 hamle basina duvar olsun (sev 15: 18500 -> 60000)',
    ara: '  { moves: 25, target1: 18500, target2: 28000, target3: 33500 },',
    yaz: '  { moves: 25, target1: 60000, target2: 70000, target3: 80000 },',
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
  const p = /^ℹ pass (\d+)$/m.exec(o) || /# pass (\d+)/.exec(o);
  const f = /^ℹ fail (\d+)$/m.exec(o) || /# fail (\d+)/.exec(o);
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
  const o = fs.readFileSync(SEVIYE, 'utf8');
  const s = o.replace(m.ara, m.yaz);
  const uygulandi = s !== o;
  const kacKez = o.split(m.ara).length - 1;
  console.log(`\n--- ${m.ad}`);
  console.log(`    arama metni ${kacKez} kez gecti | mutasyon UYGULANDI (s !== o): ${uygulandi}`);
  if (kacKez !== 1) {
    console.log(`    !!! arama metni tam olarak 1 kez gecmeli, ${kacKez} kez gecti.`);
    hepsiGecti = false;
    if (kacKez === 0) continue;
  }
  if (!uygulandi) {
    console.log('    !!! ARAMA METNI ESLESMEDI — bu mutasyon HICBIR SEY yapmadi, sinav gecersiz.');
    hepsiGecti = false;
    continue;
  }
  try {
    fs.writeFileSync(SEVIYE, s);
    const r = testKos();
    const kirmizi = r.kod !== 0;
    console.log(`    mutantla suite: ${ozet(r.cikti)} | cikis kodu ${r.kod} -> ${kirmizi ? 'KIRMIZI (dogru)' : 'YESIL (TEST KORUMUYOR!)'}`);
    if (kirmizi) {
      r.cikti.split('\n').filter((l) => /^not ok |✖/.test(l)).slice(0, 3).forEach((l) => console.log('      ' + l.trim()));
    } else {
      hepsiGecti = false;
    }
  } finally {
    fs.writeFileSync(SEVIYE, o);
  }
  const geri = testKos();
  console.log(`    geri alindi -> ${ozet(geri.cikti)} | cikis kodu ${geri.kod} ${geri.kod === 0 ? '(YESIL)' : '(BOZUK KALDI!)'}`);
  if (geri.kod !== 0) hepsiGecti = false;
}

console.log(`\n=== SONUC: ${hepsiGecti ? 'TUM mutasyonlar kirmizi oldu ve geri alindi' : 'EN AZ BIR mutasyon yakalanamadi'}`);
process.exit(hepsiGecti ? 0 : 1);
