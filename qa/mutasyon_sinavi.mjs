/**
 * MUTASYON SINAVI — "yesil suite kanit degildir".
 *
 * Her duzeltmeyi KASTEN bozar, `npm test`in KIRMIZI olmasini bekler, sonra
 * dosyayi geri yukler ve YESILI dogrular.
 *
 * Kritik ayrinti: mutasyonun GERCEKTEN uygulandigi `s !== o` ile yazdirilir.
 * Eslesmeyen bir arama metni sessizce hicbir sey yapmaz ve suite yesil kalir —
 * bu depoda daha once tam olarak bu olmustu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const KOK = 'C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1';
const MOTOR = path.join(KOK, 'src/engine/BoardEngine.js');
const EKONOMI = path.join(KOK, 'src/constants/economy.js');
const EKRAN = path.join(KOK, 'src/screens/GameScreen.js');

const MUTASYONLAR = [
  {
    ad: 'BULGU 1 — reserveSpecials hucreyi silinecekler kumesinden CIKARMASIN',
    dosya: MOTOR,
    ara: '    remaining.delete(key);',
    yaz: '    /*MUT*/',
  },
  {
    ad: 'BULGU 7 — 5-li onceligi kapat (L/T yine once kossun)',
    dosya: MOTOR,
    ara: '    if (group.cells.length < 5) return;',
    yaz: '    if (group.cells.length < 5000) return;',
  },
  {
    // ⚠️ Bu satir once COK SATIRLI arandi ve ESLESMEDI: dosya CRLF, arama
    // metni LF idi. Suite yesil kaldi ve mutasyon sessizce hicbir sey yapmadi.
    // Ders: arama metnini TEK SATIR tut, `s !== o` ve eslesme SAYISINI yazdir.
    ad: 'BULGU 6 — zincir kuyrugunu kapat (patlama yayilmasin)',
    dosya: MOTOR,
    ara: '        queue.push(k);',
    yaz: '        /*MUT*/',
  },
  {
    ad: 'BULGU 3 — colorBombSwap her zaman null donsun (takas aktivasyonu olsun)',
    dosya: MOTOR,
    ara: '  if (!aBomb && !bBomb) return null;',
    yaz: '  if (true) return null;',
  },
  {
    ad: 'BULGU 4 — shuffleBoard kirli tahtayi kabul etsin',
    dosya: MOTOR,
    ara: '    if (findMatches(g).matched.size > 0) continue;   // hazir eslesme = bedava puan',
    yaz: '    if (false) continue;',
  },
  {
    ad: 'BULGU 2 — FRENZY_CHARGE_TARGET 0 (sifir sarj bile tetiklesin)',
    dosya: EKONOMI,
    ara: 'export const FRENZY_CHARGE_TARGET = 30;',
    yaz: 'export const FRENZY_CHARGE_TARGET = 0;',
  },
  {
    ad: 'BULGU 2 — frenzy tetiklenince sarj SIFIRLANMASIN',
    dosya: EKRAN,
    ara: '          frenzyChargeRef.current = [0, 0, 0, 0, 0, 0];',
    yaz: '          /*MUT*/',
  },
  {
    ad: 'BULGU 5 — handleShuffle cascade calistirmasin (eski olu kapi)',
    dosya: EKRAN,
    ara: '      await processCascade(shuffled, 0);',
    yaz: '      /*MUT*/',
  },
  {
    ad: 'EK — cekic ozel sekerin patlamasini tetiklemesin',
    dosya: EKRAN,
    ara: '      getSpecialRemovals(grid, matchedSet).forEach((k) => matchedSet.add(k));',
    yaz: '      /*MUT*/',
  },
  {
    ad: 'BULGU 3 — GameScreen bomba takasini hic cagirmasin',
    dosya: EKRAN,
    ara: '    const bombBlast = colorBombSwap(swapped, c1, r1, c2, r2);',
    yaz: '    const bombBlast = null;',
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
  const o = fs.readFileSync(m.dosya, 'utf8');
  const s = o.replace(m.ara, m.yaz);
  const uygulandi = s !== o;
  const kacKez = o.split(m.ara).length - 1;
  console.log(`\n--- ${m.ad}`);
  console.log(`    dosya: ${path.basename(m.dosya)} | arama metni ${kacKez} kez gecti | mutasyon UYGULANDI (s !== o): ${uygulandi}`);
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
    fs.writeFileSync(m.dosya, s);
    const r = testKos();
    const kirmizi = r.kod !== 0;
    console.log(`    mutantla suite: ${ozet(r.cikti)} | cikis kodu ${r.kod} -> ${kirmizi ? 'KIRMIZI (dogru)' : 'YESIL (TEST KORUMUYOR!)'}`);
    if (kirmizi) {
      const ilk = r.cikti.split('\n').filter((l) => /^not ok |✖/.test(l)).slice(0, 3);
      ilk.forEach((l) => console.log('      ' + l.trim()));
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
